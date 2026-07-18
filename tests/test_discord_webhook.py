import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from src.api.app import app

client = TestClient(app)


def test_discord_ping_interaction():
    """Discord sends PING interaction to verify endpoint."""
    payload = {
        "type": 1,  # PING
        "application_id": "123456789",
        "token": "test_token",
    }
    response = client.post("/api/discord/webhook", json=payload)
    assert response.status_code == 200
    assert response.json() == {"type": 1}  # PONG


def test_discord_command_interaction():
    """Discord sends slash command interactions."""
    payload = {
        "type": 2,  # APPLICATION_COMMAND
        "application_id": "123456789",
        "token": "test_token",
        "data": {
            "name": "draftly",
            "options": [
                {"name": "question", "type": 3, "value": "How do I configure webhooks?"}
            ],
        },
        "member": {
            "user": {"id": "U123456", "username": "testuser"},
            "guild_id": "G123456",
        },
        "channel_id": "C123456",
    }
    with patch("src.api.routes.discord.verify_discord_signature", return_value=True):
        with patch("src.api.routes.discord.process_discord_interaction") as mock_process:
            response = client.post("/api/discord/webhook", json=payload)
            assert response.status_code == 200
            assert response.json()["type"] == 5  # CHANNEL_MESSAGE_WITH_SOURCE (deferred)
            mock_process.assert_called_once()


def test_discord_invalid_signature():
    """Reject requests with invalid signature."""
    payload = {
        "type": 2,
        "application_id": "123456789",
        "token": "test_token",
        "data": {"name": "draftly"},
    }
    with patch("src.api.routes.discord.verify_discord_signature", return_value=False):
        response = client.post("/api/discord/webhook", json=payload)
        assert response.status_code == 401
