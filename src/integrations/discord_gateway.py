"""Discord Gateway WebSocket client — connects to the Discord Gateway for real-time events."""
from __future__ import annotations

import asyncio
import json

import structlog
import websockets
from websockets.exceptions import ConnectionClosed

from src.config import settings

logger = structlog.get_logger()

GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json"
HEARTBEAT_INTERVAL_BUFFER = 5  # seconds to subtract from heartbeat interval


class DiscordGateway:
    """Maintains a persistent WebSocket connection to the Discord Gateway."""

    def __init__(self) -> None:
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._heartbeat_task: asyncio.Task[None] | None = None
        self._sequence: int | None = None
        self._session_id: str | None = None
        self._running = False

    async def start(self) -> None:
        """Connect to the Gateway and begin listening for events."""
        token = settings.discord_bot_token.get_secret_value()
        if not token:
            logger.error("discord_gateway_no_token")
            return

        self._running = True
        logger.info("discord_gateway_starting")

        while self._running:
            try:
                async with websockets.connect(GATEWAY_URL) as ws:
                    self._ws = ws
                    logger.info("discord_gateway_connected")
                    await self._handle_connection(ws)
            except ConnectionClosed as e:
                logger.warning("discord_gateway_connection_closed", code=e.code)
            except Exception as e:
                logger.error("discord_gateway_error", error=str(e))

            if self._running:
                logger.info("discord_gateway_reconnecting")
                await asyncio.sleep(5)

    async def _handle_connection(self, ws: websockets.WebSocketClientProtocol) -> None:
        """Handle a single Gateway connection lifecycle."""
        async for raw in ws:
            msg = json.loads(raw)
            op = msg.get("op")
            event = msg.get("t")
            data = msg.get("d")
            s = msg.get("s")

            if s is not None:
                self._sequence = s

            # Opcode 0: Dispatch (event)
            if op == 0:
                await self._handle_dispatch(event, data)

            # Opcode 1: Heartbeat
            elif op == 1:
                await self._send_heartbeat(ws)

            # Opcode 10: Hello (connection established)
            elif op == 10:
                heartbeat_interval = data.get("heartbeat_interval", 41250) / 1000
                if self._heartbeat_task and not self._heartbeat_task.done():
                    self._heartbeat_task.cancel()
                self._heartbeat_task = asyncio.create_task(
                    self._heartbeat_loop(ws, heartbeat_interval)
                )
                # Send Identify
                await self._send_identify(ws)

            # Opcode 11: Heartbeat ACK
            elif op == 11:
                pass  # Heartbeat acknowledged

    async def _send_identify(self, ws: websockets.WebSocketClientProtocol) -> None:
        """Send the Identify payload to authenticate with the Gateway."""
        token = settings.discord_bot_token.get_secret_value()
        identify = {
            "op": 2,
            "d": {
                "token": token,
                "intents": 513,  # GUILDS (1) + MESSAGE_CONTENT (512)
            },
        }
        await ws.send(json.dumps(identify))
        logger.info("discord_gateway_identified")

    async def _heartbeat_loop(
        self,
        ws: websockets.WebSocketClientProtocol,
        interval: float,
    ) -> None:
        """Send heartbeats at the interval specified by the Gateway."""
        try:
            while self._running:
                await asyncio.sleep(interval - HEARTBEAT_INTERVAL_BUFFER)
                await self._send_heartbeat(ws)
        except asyncio.CancelledError:
            pass

    async def _send_heartbeat(self, ws: websockets.WebSocketClientProtocol) -> None:
        """Send a heartbeat payload."""
        heartbeat = {"op": 1, "d": self._sequence}
        await ws.send(json.dumps(heartbeat))

    async def _handle_dispatch(self, event: str | None, data: dict | None) -> None:
        """Route dispatch events to appropriate handlers."""
        if not event or not data:
            return

        if event == "READY":
            self._session_id = data.get("session_id")
            logger.info("discord_gateway_ready", session_id=self._session_id)
            return

        if event == "MESSAGE_CREATE":
            from src.integrations.discord_app import handle_message_create

            await handle_message_create(data)

    async def stop(self) -> None:
        """Gracefully shut down the Gateway connection."""
        self._running = False
        if self._heartbeat_task and not self._heartbeat_task.done():
            self._heartbeat_task.cancel()
        if self._ws:
            await self._ws.close()
        logger.info("discord_gateway_stopped")


gateway = DiscordGateway()
