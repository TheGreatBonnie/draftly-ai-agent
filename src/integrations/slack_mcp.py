"""Slack MCP Server client for user-context operations."""
from __future__ import annotations

from typing import Any

import structlog

logger = structlog.get_logger()

SLACK_MCP_URL = "https://mcp.slack.com/mcp"


class SlackMCPClient:
    """Wrapper around the MCP client for Slack MCP Server."""

    def __init__(self, url: str, headers: dict[str, str]) -> None:
        self.url = url
        self.headers = headers
        self._session: Any = None
        self._streams: Any = None
        self._cleanup: Any = None

    async def connect(self) -> None:
        """Connect to the MCP server and initialize a session."""
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client

        streams_cm = streamablehttp_client(url=self.url, headers=self.headers)
        self._streams = await streams_cm.__aenter__()
        read_stream, write_stream, get_session_id = self._streams

        self._session = ClientSession(read_stream, write_stream)
        await self._session.__aenter__()
        await self._session.initialize()
        self._cleanup = streams_cm
        logger.info("slack_mcp_connected", url=self.url)

    async def call_tool(self, name: str, arguments: dict) -> Any:
        """Call a tool on the MCP server."""
        if not self._session:
            return None
        try:
            result = await self._session.call_tool(name, arguments)
            return result
        except Exception as e:
            logger.error("slack_mcp_tool_call_failed", tool=name, error=str(e))
            return None

    async def close(self) -> None:
        """Close the MCP connection."""
        try:
            if self._session:
                await self._session.__aexit__(None, None, None)
            if self._cleanup:
                await self._cleanup.__aexit__(None, None, None)
        except Exception:
            pass


async def get_slack_mcp_tools(user_token: str) -> SlackMCPClient | None:
    """Return an MCP client connected to Slack's MCP Server, or None if no user token."""
    if not user_token:
        return None

    try:
        client = SlackMCPClient(
            url=SLACK_MCP_URL,
            headers={"Authorization": f"Bearer {user_token}"},
        )
        await client.connect()
        return client
    except ImportError:
        logger.warning("mcp_sdk_not_installed")
        return None
    except Exception as e:
        logger.error("slack_mcp_connection_failed", error=str(e))
        return None
