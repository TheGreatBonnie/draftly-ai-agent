from __future__ import annotations

import hashlib
import hmac
import json

import structlog
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from src.config import settings
from src.memory.reviewer import complete_review
from src.security.tokens import verify_review_token

logger = structlog.get_logger()

router = APIRouter()

STATUS_MAP = {
    "approve": "approved",
    "reject": "rejected",
    "revise": "needs_changes",
}


def _verify_slack_signature(body: bytes, timestamp: str, signature: str) -> bool:
    """Verify Slack request signature using HMAC SHA256."""
    signing_secret = settings.slack_signing_secret.get_secret_value()
    if not signing_secret:
        return False

    basestring = f"v0:{timestamp}:{body.decode()}"
    computed = hmac.new(
        signing_secret.encode(),
        basestring.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(f"v0={computed}", signature)


@router.post("/interactivity")
async def handle_slack_interactivity(request: Request) -> JSONResponse:
    """Handle Slack interactivity payloads (button clicks, dropdowns, url_verification)."""
    body = await request.body()

    # Verify Slack request signature
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")
    if timestamp and signature and not _verify_slack_signature(body, timestamp, signature):
        logger.error("slack_signature_verification_failed")
        return JSONResponse(status_code=401, content={"error": "Invalid signature"})

    # Slack sends form-encoded data with a "payload" field, not raw JSON
    form_data = await request.form()
    payload_str = str(form_data.get("payload", "{}"))
    payload_data = json.loads(payload_str)

    # Handle url_verification challenge (sent when configuring the Request URL)
    if payload_data.get("type") == "url_verification":
        return JSONResponse(content={"challenge": payload_data.get("challenge", "")})

    # Handle block_actions (button clicks, dropdowns)
    if payload_data.get("type") == "block_actions":
        actions = payload_data.get("actions", [])

        for action in actions:
            action_id = action.get("action_id")
            token = action.get("value")

            if action_id in ("approve_review", "reject_review", "revise_review"):
                decision = action_id.replace("_review", "")
                token_data = verify_review_token(token)
                if token_data:
                    review_id: str = token_data.get("review_id", "")
                    await complete_review(
                        review_id=review_id,
                        status=STATUS_MAP[decision],
                        feedback=None,
                    )

                    try:
                        from src.agents.runners.resume import resume_review

                        await resume_review(
                            review_id=review_id,
                            decision=decision,
                            feedback="",
                        )
                    except Exception as e:
                        logger.error(
                            "graph_resume_failed",
                            review_id=review_id,
                            error=str(e),
                        )

                    return JSONResponse(
                        content={
                            "text": f"Review {decision}d successfully",
                            "replace_original": False,
                        }
                    )

    return JSONResponse(content={})
