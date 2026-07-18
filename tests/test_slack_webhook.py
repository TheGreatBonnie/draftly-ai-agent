import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from src.api.app import app

client = TestClient(app)


def test_slack_url_verification():
    """Slack sends URL verification challenge on first setup."""
    payload = {
        "type": "url_verification",
        "challenge": "test_challenge_token_123",
        "token": "test_token",
    }
    response = client.post("/api/slack/webhook", json=payload)
    assert response.status_code == 200
    assert response.json() == {"challenge": "test_challenge_token_123"}


def test_slack_event_callback():
    """Slack sends event callbacks for messages."""
    payload = {
        "type": "event_callback",
        "token": "test_token",
        "team_id": "T123456",
        "event": {
            "type": "message",
            "channel": "C123456",
            "user": "U123456",
            "text": "<@U789012> How do I configure webhooks?",
            "ts": "1234567890.123456",
        },
    }
    with patch("src.api.routes.slack.verify_slack_signature", return_value=True):
        with patch("src.api.routes.slack.process_slack_event") as mock_process:
            response = client.post("/api/slack/webhook", json=payload)
            assert response.status_code == 200
            assert response.json() == {"ok": True}
            mock_process.assert_called_once()


def test_slack_invalid_signature():
    """Reject requests with invalid signature."""
    payload = {
        "type": "event_callback",
        "token": "test_token",
        "team_id": "T123456",
        "event": {
            "type": "message",
            "channel": "C123456",
            "user": "U123456",
            "text": "Hello",
            "ts": "1234567890.123456",
        },
    }
    with patch("src.api.routes.slack.verify_slack_signature", return_value=False):
        response = client.post("/api/slack/webhook", json=payload)
        assert response.status_code == 401
