from __future__ import annotations

import httpx
import structlog

from src.config import settings

logger = structlog.get_logger()


async def send_discord_message(channel_id: str, content: str) -> dict:
    headers = {"Authorization": f"Bot {settings.discord_bot_token.get_secret_value()}", "Content-Type": "application/json"}
    payload = {"content": content}

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


async def send_discord_thread_reply(thread_id: str, content: str) -> dict:
    headers = {"Authorization": f"Bot {settings.discord_bot_token.get_secret_value()}", "Content-Type": "application/json"}
    payload = {"content": content}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://discord.com/api/v10/channels/{thread_id}/messages",
            headers=headers,
            json=payload,
            timeout=10,
        )
        return resp.json()
