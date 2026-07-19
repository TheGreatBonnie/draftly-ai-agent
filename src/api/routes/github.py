from __future__ import annotations

import json

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel

from src.agents.runners.github_runner import run_github_pipeline
from src.integrations.github_app import get_installation_token, verify_webhook_signature

logger = structlog.get_logger()

router = APIRouter()


class WebhookResponse(BaseModel):
    status: str


@router.post("/webhook")
async def github_webhook(request: Request, background_tasks: BackgroundTasks) -> WebhookResponse:
    """Receive and process GitHub webhook events."""
    # 1. Read raw body for signature verification
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")

    # 2. Verify webhook signature
    if signature is None or not verify_webhook_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # 3. Parse payload
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = request.headers.get("X-GitHub-Event")

    # 4. Handle issue events
    if event_type == "issues" and payload.get("action") == "opened":
        installation_id = payload["installation"]["id"]

        # Get installation token
        try:
            token = await get_installation_token(installation_id)
        except Exception as e:
            logger.error("failed_to_get_installation_token", error=str(e))
            raise HTTPException(status_code=500, detail="Failed to get installation token")

        # Offload to background task (GitHub timeout is 10s)
        background_tasks.add_task(run_github_pipeline, payload=payload, installation_token=token)

        logger.info(
            "github_webhook_received",
            event_type=event_type,
            action=payload.get("action"),
            repo=payload.get("repository", {}).get("full_name"),
            issue=payload.get("issue", {}).get("number"),
        )

        return WebhookResponse(status="Processing issue event")

    # 5. Ignore other events
    logger.info("github_event_ignored", event_type=event_type)
    return WebhookResponse(status="Event ignored")
