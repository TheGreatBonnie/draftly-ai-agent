import json
from unittest.mock import patch

from fastapi.testclient import TestClient

from src.api.app import app

client = TestClient(app)


@patch("src.api.routes.slack.verify_review_token")
@patch("src.api.routes.slack.complete_review")
def test_interactivity_approve_button(mock_complete, mock_verify_token):
    mock_verify_token.return_value = {"review_id": "review123", "reviewer_id": "U123"}
    mock_complete.return_value = None

    payload = {
        "type": "block_actions",
        "user": {"id": "U123"},
        "actions": [
            {
                "action_id": "approve_review",
                "value": "test_token_123",
            }
        ],
        "container": {"message_ts": "1234567890"},
    }

    response = client.post(
        "/api/slack/interactivity",
        data={"payload": json.dumps(payload)},
    )

    assert response.status_code == 200
    mock_verify_token.assert_called_once_with("test_token_123")
    mock_complete.assert_called_once()


@patch("src.api.routes.slack.verify_review_token")
@patch("src.api.routes.slack.complete_review")
def test_interactivity_reject_button(mock_complete, mock_verify_token):
    mock_verify_token.return_value = {"review_id": "review456", "reviewer_id": "U456"}
    mock_complete.return_value = None

    payload = {
        "type": "block_actions",
        "user": {"id": "U456"},
        "actions": [
            {
                "action_id": "reject_review",
                "value": "reject_token_456",
            }
        ],
    }

    response = client.post(
        "/api/slack/interactivity",
        data={"payload": json.dumps(payload)},
    )

    assert response.status_code == 200
    mock_verify_token.assert_called_once_with("reject_token_456")
    mock_complete.assert_called_once()


@patch("src.api.routes.slack.verify_review_token")
@patch("src.api.routes.slack.complete_review")
def test_interactivity_invalid_token(mock_complete, mock_verify_token):
    mock_verify_token.return_value = None

    payload = {
        "type": "block_actions",
        "user": {"id": "U123"},
        "actions": [
            {
                "action_id": "approve_review",
                "value": "invalid_token",
            }
        ],
    }

    response = client.post(
        "/api/slack/interactivity",
        data={"payload": json.dumps(payload)},
    )

    assert response.status_code == 200
    mock_complete.assert_not_called()


def test_interactivity_unknown_action_type():
    payload = {
        "type": "message_action",
        "user": {"id": "U123"},
    }

    response = client.post(
        "/api/slack/interactivity",
        data={"payload": json.dumps(payload)},
    )

    assert response.status_code == 200
