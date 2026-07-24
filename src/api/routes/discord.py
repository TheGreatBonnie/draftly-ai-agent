from __future__ import annotations

import json

import structlog
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.agents.runners.resume import resume_review
from src.api.auth import get_verified_token
from src.config import settings
from src.database import execute, fetch_one
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


# --- Settings endpoints ---


class LinkDiscordRequest(BaseModel):
    guild_id: str


@router.get("/invite-url")
async def discord_invite_url():
    """Return the Discord bot invite URL with required permissions."""
    app_id = settings.discord_app_id
    if not app_id:
        raise HTTPException(status_code=500, detail="Discord app ID not configured")
    # Permissions: Send Messages (2048) + Send Messages in Threads (32768) = 34816
    invite_url = (
        f"https://discord.com/api/oauth2/authorize"
        f"?client_id={app_id}"
        f"&permissions=34816"
        f"&scope=bot"
    )
    return {"invite_url": invite_url}


@router.post("/link")
async def link_discord(
    request: LinkDiscordRequest,
    token: dict = Depends(get_verified_token),
):
    """Link a Discord guild to the current Clerk organization."""
    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    await execute(
        "UPDATE organizations SET discord_guild_id = $1 WHERE clerk_org_id = $2",
        request.guild_id,
        org_id,
    )
    logger.info("discord_linked", org_id=org_id, guild_id=request.guild_id)
    return {"status": "linked", "guild_id": request.guild_id}


@router.get("/status")
async def discord_status(token: dict = Depends(get_verified_token)):
    """Return the Discord connection status for the current org."""
    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    row = await fetch_one(
        "SELECT discord_guild_id FROM organizations WHERE clerk_org_id = $1",
        org_id,
    )
    connected = bool(row and row["discord_guild_id"])
    return {
        "connected": connected,
        "guild_id": row["discord_guild_id"] if row else None,
    }
