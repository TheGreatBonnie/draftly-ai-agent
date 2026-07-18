"""GitHub webhook endpoint for receiving issue events."""

from __future__ import annotations

import json

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from src.integrations.github_app import get_installation_token, verify_webhook_signature

logger = structlog.get_router()

router = APIRouter()


@router.post("/webhook")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    """Receive and process GitHub webhook events.

    This endpoint handles:
    - Issue opened events: Triggers the Draftly pipeline
    - Other events: Ignored with 200 response
    """
    # Read raw body for signature verification
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")

    # Verify webhook signature
    if not verify_webhook_signature(body, signature):
        logger.warning("invalid_webhook_signature")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Parse payload
    payload = json.loads(body)
    event_type = request.headers.get("X-GitHub-Event")

    logger.info("webhook_received", event_type=event_type)

    # Handle issue events
    if event_type == "issues" and payload.get("action") == "opened":
        installation_id = payload["installation"]["id"]
        issue = payload["issue"]
        repo = payload["repository"]

        logger.info(
            "issue_opened",
            owner=repo["owner"]["login"],
            repo=repo["name"],
            issue_number=issue["number"],
        )

        # Get installation token
        token = get_installation_token(installation_id)

        # Offload to background task (GitHub timeout is 10s)
        background_tasks.add_task(
            _process_issue_background,
            payload=payload,
            installation_token=token,
        )

        return {"status": "Processing issue event"}

    return {"status": "Event ignored"}


async def _process_issue_background(payload: dict, installation_token: str):
    """Process issue in background task.

    This function will be implemented in the github_runner module.
    For now, it just logs the event.
    """
    issue = payload["issue"]
    repo = payload["repository"]

    logger.info(
        "processing_issue",
        owner=repo["owner"]["login"],
        repo=repo["name"],
        issue_number=issue["number"],
        title=issue["title"],
    )

    # TODO: Implement pipeline runner in feature/github-runner branch
    # from src.agents.runners.github_runner import run_github_pipeline
    # await run_github_pipeline(payload, installation_token)
