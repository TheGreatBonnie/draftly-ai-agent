from __future__ import annotations

import json

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel

from src.agents.runners.github_runner import run_github_pipeline
from src.config import settings
from src.integrations.github_app import get_installation_token, verify_webhook_signature

logger = structlog.get_logger()

router = APIRouter()


class WebhookResponse(BaseModel):
    status: str


@router.get("/install-url")
async def github_install_url():
    if not settings.github_app_slug:
        raise HTTPException(status_code=500, detail="GitHub App slug not configured")
    return {"install_url": f"https://github.com/apps/{settings.github_app_slug}/installations/new"}


@router.get("/installations")
async def github_installations():
    from src.memory.organizations import list_github_installations

    return await list_github_installations()


@router.post("/webhook")
async def github_webhook(request: Request, background_tasks: BackgroundTasks) -> WebhookResponse:
    """Receive and process GitHub webhook events."""
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")

    if signature is None or not verify_webhook_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = request.headers.get("X-GitHub-Event")

    # Handle installation events (created/deleted)
    if event_type == "installation":
        from src.memory.organizations import (
            get_or_create_org,
            remove_github_installation,
            store_github_installation,
        )

        action = payload.get("action")
        installation = payload.get("installation")
        if not installation:
            logger.warning("github_installation_malformed")
            return WebhookResponse(status="Bad request")

        installation_id = installation["id"]
        account = installation.get("account") or {}
        github_org = account.get("login", "unknown")

        if action == "created":
            repositories = [
                {"full_name": repo["full_name"], "id": repo["id"]}
                for repo in payload.get("repositories", [])
            ]
            org_id = await get_or_create_org(github_org=github_org)
            await store_github_installation(
                org_id=org_id,
                installation_id=installation_id,
                github_org=github_org,
                repositories=repositories,
            )
            logger.info(
                "github_app_installed",
                installation_id=installation_id,
                org=github_org,
                repo_count=len(repositories),
            )
            return WebhookResponse(status="Installation created")

        elif action == "deleted":
            await remove_github_installation(installation_id)
            logger.info(
                "github_app_uninstalled",
                installation_id=installation_id,
                org=github_org,
            )
            return WebhookResponse(status="Installation deleted")

        return WebhookResponse(status=f"Installation {action} (unhandled)")

    # Handle issue events
    if event_type == "issues" and payload.get("action") == "opened":
        installation_id = payload["installation"]["id"]

        try:
            token = await get_installation_token(installation_id)
        except Exception as e:
            logger.error("failed_to_get_installation_token", error=str(e))
            raise HTTPException(status_code=500, detail="Failed to get installation token")

        background_tasks.add_task(run_github_pipeline, payload=payload, installation_token=token)

        logger.info(
            "github_webhook_received",
            event_type=event_type,
            action=payload.get("action"),
            repo=payload.get("repository", {}).get("full_name"),
            issue=payload.get("issue", {}).get("number"),
        )

        return WebhookResponse(status="Processing issue event")

    # Ignore other events
    logger.info("github_event_ignored", event_type=event_type)
    return WebhookResponse(status="Event ignored")
