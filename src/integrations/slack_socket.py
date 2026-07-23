"""Socket Mode entry point for local development without ngrok."""
from __future__ import annotations

import structlog
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler

from src.config import settings
from src.integrations.slack_app import slack_app

logger = structlog.get_logger()


def should_use_socket_mode() -> bool:
    """Check if SLACK_APP_TOKEN is configured."""
    return bool(settings.slack_app_token.get_secret_value())


async def start_socket_mode() -> None:
    """Start the Slack app in Socket Mode (WebSocket, no public URL needed)."""
    token = settings.slack_app_token.get_secret_value()
    handler = AsyncSocketModeHandler(slack_app, token)
    logger.info("slack_socket_mode_starting")
    await handler.start_async()
