from __future__ import annotations

from typing import Optional

import httpx
import structlog

from src.config import settings

logger = structlog.get_logger()


async def post_to_slack(
    channel: str,
    message: str,
    thread_ts: Optional[str] = None,
) -> dict:
    """Post message to Slack channel."""
    if not settings.slack_bot_token:
        logger.warning("slack_not_configured")
        return {"ok": False, "error": "Slack not configured"}

    token = settings.slack_bot_token.get_secret_value()
    payload = {"channel": channel, "text": message, "mrkdwn": True}

    if thread_ts:
        payload["thread_ts"] = thread_ts

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://slack.com/api/chat.postMessage",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=10,
        )
        data = resp.json()

        if not data.get("ok"):
            logger.error("slack_post_failed", error=data.get("error"), channel=channel)
        else:
            logger.info("slack_post_success", channel=channel, ts=data.get("ts"))

        return data


async def post_to_discord(channel_id: str, message: str) -> dict:
    """Post message to Discord channel via webhook."""
    if not settings.discord_bot_token:
        logger.warning("discord_not_configured")
        return {"ok": False, "error": "Discord not configured"}

    token = settings.discord_bot_token.get_secret_value()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://discord.com/api/v10/channels/{channel_id}/messages",
            headers={"Authorization": f"Bot {token}"},
            json={"content": message},
            timeout=10,
        )
        data = resp.json()

        if resp.status_code != 200:
            logger.error("discord_post_failed", error=data.get("message"), channel_id=channel_id)
        else:
            logger.info("discord_post_success", channel_id=channel_id, message_id=data.get("id"))

        return data


async def post_to_github(repo: str, issue_number: int, body: str) -> dict:
    """Post comment to GitHub issue."""
    if not settings.github_token:
        logger.warning("github_not_configured")
        return {"ok": False, "error": "GitHub not configured"}

    token = settings.github_token.get_secret_value()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/repos/{repo}/issues/{issue_number}/comments",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json",
            },
            json={"body": body},
            timeout=10,
        )
        data = resp.json()

        if resp.status_code not in (200, 201):
            logger.error("github_post_failed", repo=repo, issue=issue_number)
        else:
            logger.info("github_post_success", repo=repo, issue=issue_number)

        return data


async def deliver_results(
    channel: str,
    message: str,
    thread_ts: Optional[str] = None,
    repo: Optional[str] = None,
    issue_number: Optional[int] = None,
):
    """Deliver pipeline results to configured channels."""
    results = {}

    if channel == "slack" or channel == "all":
        results["slack"] = await post_to_slack(
            channel=settings.slack_channel_id or "",
            message=message,
            thread_ts=thread_ts,
        )

    if channel == "discord" or channel == "all":
        results["discord"] = await post_to_discord(
            channel_id=settings.discord_channel_id or "",
            message=message,
        )

    if repo and issue_number:
        results["github"] = await post_to_github(
            repo=repo,
            issue_number=issue_number,
            body=message,
        )

    return results
