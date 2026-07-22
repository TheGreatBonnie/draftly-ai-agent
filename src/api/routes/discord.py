from __future__ import annotations

import json

import structlog
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from src.agents.runners.resume import resume_review
from src.config import settings
from src.integrations.discord_interactions import resolve_interaction_token
from src.memory.reviewer import complete_review
from src.security.tokens import verify_review_token

logger = structlog.get_logger()

router = APIRouter()

ACTION_MAP = {
    "discord_approve": "approved",
    "discord_reject": "rejected",
    "discord_revise": "needs_changes",
    "discord_feedback": "needs_changes",
}

STATUS_COLOR = {
    "approved": 3066993,
    "rejected": 15158332,
    "needs_changes": 16776960,
}

STATUS_LABEL = {
    "approved": "Approved",
    "rejected": "Rejected",
    "needs_changes": "Changes Requested",
}


def _verify_signature(body: bytes, timestamp: str, signature: str) -> bool:
    """Verify Ed25519 signature from Discord."""
    public_key_hex = settings.discord_public_key.get_secret_value()
    if not public_key_hex:
        return False

    try:
        public_key_bytes = bytes.fromhex(public_key_hex)
        public_key = Ed25519PublicKey.from_public_bytes(public_key_bytes)
        message = timestamp.encode() + body
        signature_bytes = bytes.fromhex(signature)
        public_key.verify(signature_bytes, message)
        return True
    except Exception:
        return False


def _build_result_response(status: str, title: str) -> dict:
    """Build a Discord UPDATE_MESSAGE response with result embed."""
    return {
        "type": 7,
        "data": {
            "content": "",
            "embeds": [
                {
                    "title": f"Documentation Review — {STATUS_LABEL.get(status, status)}",
                    "description": (
                        f"**{title}**\n\n"
                        f"This review has been "
                        f"{STATUS_LABEL.get(status, status).lower()}."
                    ),
                    "color": STATUS_COLOR.get(status, 10070709),
                }
            ],
            "components": [],
        },
    }


@router.post("/interactions")
async def handle_interactions(request: Request) -> JSONResponse:
    """Handle Discord component interactions (button clicks, select menus)."""
    body = await request.body()

    timestamp = request.headers.get("X-Signature-Timestamp", "")
    signature = request.headers.get("X-Signature-Ed25519", "")
    if not timestamp or not signature:
        return JSONResponse(status_code=401, content={"error": "Missing signature"})

    if not _verify_signature(body, timestamp, signature):
        logger.error("discord_signature_verification_failed")
        return JSONResponse(status_code=401, content={"error": "Invalid signature"})

    payload = json.loads(body)

    interaction_type = payload.get("type")

    if interaction_type == 1:
        return JSONResponse(content={"type": 1})

    if interaction_type == 3:
        custom_id = payload.get("data", {}).get("custom_id", "")
        parts = custom_id.split(":", 1)
        if len(parts) != 2:
            return JSONResponse(status_code=400, content={"error": "Invalid custom_id"})

        action_prefix, short_key = parts
        action = ACTION_MAP.get(action_prefix)
        if not action:
            return JSONResponse(status_code=400, content={"error": "Unknown action"})

        full_token = resolve_interaction_token(short_key)
        if not full_token:
            return JSONResponse(
                content={
                    "type": 4,
                    "data": {
                        "content": (
                            "This review link has expired or is invalid. "
                            "Please use the dashboard instead."
                        ),
                        "flags": 64,
                    },
                },
            )

        token_data = verify_review_token(full_token)
        if not token_data:
            return JSONResponse(
                content={
                    "type": 4,
                    "data": {
                        "content": (
                            "This review link has expired or is invalid. "
                            "Please use the dashboard instead."
                        ),
                        "flags": 64,
                    },
                },
            )

        review_id = token_data.get("review_id", "")
        feedback = None
        if action_prefix == "discord_feedback":
            values = payload.get("data", {}).get("values", [])
            feedback = values[0] if values else ""

        try:
            await complete_review(review_id=review_id, status=action, feedback=feedback)
        except Exception as e:
            logger.error("discord_review_complete_failed", review_id=review_id, error=str(e))
            return JSONResponse(
                content={
                    "type": 4,
                    "data": {
                        "content": (
                            "Failed to process review. "
                            "Please try the dashboard."
                        ),
                        "flags": 64,
                    },
                },
            )

        try:
            decision = action.split("_")[0] if "_" in action else action
            await resume_review(
                review_id=review_id,
                decision=decision,
                feedback=feedback or "",
            )
        except Exception as e:
            logger.error("discord_graph_resume_failed", review_id=review_id, error=str(e))

        title = (
            payload.get("message", {})
            .get("embeds", [{}])[0]
            .get("description", "")
            .split("\n")[0]
            .replace("**Title:** ", "")
            .strip()
            or "Documentation"
        )

        return JSONResponse(content=_build_result_response(action, title))

    return JSONResponse(status_code=400, content={"error": "Unknown interaction type"})
