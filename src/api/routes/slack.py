from __future__ import annotations

import hashlib
import hmac

import httpx
import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from src.config import settings

logger = structlog.get_logger()
router = APIRouter()


async def verify_slack_signature(body: bytes, timestamp: str, signature: str) -> bool:
    """Verify Slack request signature using signing secret."""
    if not settings.slack_signing_secret:
        logger.warning("slack_signing_not_configured")
        return True

    signing_secret = settings.slack_signing_secret.get_secret_value()
    basestring = f"v0:{timestamp}:{body.decode()}"
    expected = "v0=" + hmac.new(
        signing_secret.encode(), basestring.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def get_bot_id() -> str:
    """Get bot user ID from Slack API."""
    token = settings.slack_bot_token.get_secret_value()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://slack.com/api/auth.test",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        data = resp.json()
        return data.get("user_id", "")


async def process_slack_event(event: dict, team_id: str):
    """Process Slack event in background."""
    event_type = event.get("type")

    if event_type == "message" and "bot_id" not in event:
        channel = event.get("channel")
        user = event.get("user")
        text = event.get("text", "")
        thread_ts = event.get("thread_ts", event.get("ts"))

        # Only process if bot is mentioned or in support channel
        if settings.slack_bot_token:
            try:
                bot_id = await get_bot_id()
                if f"<@{bot_id}>" in text:
                    logger.info(
                        "slack_bot_mentioned",
                        channel=channel,
                        user=user,
                        thread_ts=thread_ts,
                    )
                    # TODO: Run pipeline when slack_runner is implemented
                    # await run_slack_pipeline(
                    #     channel=channel,
                    #     thread_ts=thread_ts,
                    #     user=user,
                    #     text=text,
                    #     team_id=team_id,
                    # )
            except Exception as e:
                logger.error("slack_event_processing_failed", error=str(e))


@router.post("/webhook")
async def slack_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle Slack webhook events."""
    body = await request.body()
    payload = await request.json()

    # Handle URL verification
    if payload.get("type") == "url_verification":
        return {"challenge": payload.get("challenge")}

    # Handle event callbacks
    if payload.get("type") == "event_callback":
        timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
        signature = request.headers.get("X-Slack-Signature", "")

        if not await verify_slack_signature(body, timestamp, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

        event = payload.get("event", {})
        team_id = payload.get("team_id")

        background_tasks.add_task(process_slack_event, event, team_id)
        return {"ok": True}

    return {"ok": True}
