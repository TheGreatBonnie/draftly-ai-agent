from __future__ import annotations

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from src.config import settings

logger = structlog.get_logger()
router = APIRouter()


async def verify_discord_signature(body: bytes, signature: str, timestamp: str) -> bool:
    """Verify Discord request signature using Ed25519."""
    if not settings.discord_public_key:
        logger.warning("discord_public_not_configured")
        return True

    try:
        from nacl.signing import VerifyKey
        from nacl.exceptions import BadSignatureError

        public_key = settings.discord_public_key.get_secret_value()
        verify_key = VerifyKey(bytes.fromhex(public_key))
        message = f"{timestamp}{body.decode()}"
        verify_key.verify(message.encode(), bytes.fromhex(signature))
        return True
    except BadSignatureError:
        return False
    except Exception as e:
        logger.error("discord_signature_verification_failed", error=str(e))
        return False


async def process_discord_interaction(interaction: dict):
    """Process Discord interaction in background."""
    interaction_type = interaction.get("type")

    if interaction_type == 2:  # APPLICATION_COMMAND
        data = interaction.get("data", {})
        command_name = data.get("name")

        if command_name == "draftly":
            options = data.get("options", [])
            question = next(
                (opt["value"] for opt in options if opt["name"] == "question"), ""
            )

            user = interaction.get("member", {}).get("user", {})
            channel_id = interaction.get("channel_id")
            guild_id = interaction.get("guild_id")

            logger.info(
                "discord_command_received",
                user_id=user.get("id"),
                channel_id=channel_id,
                guild_id=guild_id,
                question=question,
            )

            # TODO: Run pipeline when discord_runner is implemented
            # await run_discord_pipeline(
            #     channel_id=channel_id,
            #     guild_id=guild_id,
            #     user_id=user.get("id"),
            #     question=question,
            # )


@router.post("/webhook")
async def discord_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle Discord webhook interactions."""
    body = await request.body()
    payload = await request.json()

    # Handle PING interaction
    if payload.get("type") == 1:
        return {"type": 1}  # PONG

    # Handle command interactions
    if payload.get("type") == 2:
        signature = request.headers.get("X-Signature-Ed25519", "")
        timestamp = request.headers.get("X-Signature-Timestamp", "")

        if not await verify_discord_signature(body, signature, timestamp):
            raise HTTPException(status_code=401, detail="Invalid signature")

        # Return deferred response immediately
        background_tasks.add_task(process_discord_interaction, payload)
        return {"type": 5}  # CHANNEL_MESSAGE_WITH_SOURCE (deferred)

    return {"type": 1}
