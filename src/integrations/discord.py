from __future__ import annotations

import httpx
import structlog

from src.config import settings

logger = structlog.get_logger()


def _build_payload(
    content: str | None = None,
    embed: dict | None = None,
    components: list[dict] | None = None,
) -> dict:
    """Build a Discord API message payload."""
    payload: dict = {}
    if content is not None:
        payload["content"] = content
    if embed is not None:
        payload["embeds"] = [embed]
    if components is not None:
        payload["components"] = components
    return payload


async def get_or_create_dm_channel(user_id: str) -> str:
    """Open a DM channel with a user and return the channel ID."""
    token = settings.discord_bot_token.get_secret_value()
    headers = {"Authorization": f"Bot {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://discord.com/api/v10/users/@me/channels",
            headers=headers,
            json={"recipient_id": user_id},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["id"]


async def send_discord_message(
    channel_id: str,
    content: str | None = None,
    embed: dict | None = None,
    components: list[dict] | None = None,
) -> dict:
    """Send a message to a Discord channel, optionally with embeds and components."""
    token = settings.discord_bot_token.get_secret_value()
    headers = {"Authorization": f"Bot {token}", "Content-Type": "application/json"}
    payload = _build_payload(content, embed, components)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://discord.com/api/v10/channels/{channel_id}/messages",
            headers=headers,
            json=payload,
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            logger.error("discord_send_failed", status=resp.status_code, body=resp.text)
        return resp.json()


async def edit_discord_message(
    channel_id: str,
    message_id: str,
    content: str | None = None,
    embed: dict | None = None,
    components: list[dict] | None = None,
) -> dict:
    """Edit an existing Discord message."""
    token = settings.discord_bot_token.get_secret_value()
    headers = {"Authorization": f"Bot {token}", "Content-Type": "application/json"}
    payload = _build_payload(content, embed, components)

    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"https://discord.com/api/v10/channels/{channel_id}/messages/{message_id}",
            headers=headers,
            json=payload,
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            logger.error("discord_edit_failed", status=resp.status_code, body=resp.text)
        return resp.json()


async def send_discord_thread_reply(thread_id: str, content: str) -> dict:
    """Send a reply to a Discord thread."""
    token = settings.discord_bot_token.get_secret_value()
    headers = {"Authorization": f"Bot {token}", "Content-Type": "application/json"}
    payload = {"content": content}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://discord.com/api/v10/channels/{thread_id}/messages",
            headers=headers,
            json=payload,
            timeout=10,
        )
        return resp.json()
