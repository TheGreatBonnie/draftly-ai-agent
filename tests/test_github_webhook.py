"""Tests for GitHub webhook endpoint."""

import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.api.app import app


client = TestClient(app)


def create_signature(payload: bytes, secret: str) -> str:
    """Create a valid webhook signature for testing."""
    mac = hmac.new(secret.encode("utf-8"), msg=payload, digestmod=hashlib.sha256)
    return f"sha256={mac.hexdigest()}"


class TestGitHubWebhook:
    """Tests for the GitHub webhook endpoint."""

    def test_webhook_valid_issue_opened(self):
        """Should accept valid issue opened event."""
        payload = {
            "action": "opened",
            "issue": {
                "number": 1,
                "title": "Test Issue",
                "body": "This is a test issue",
            },
            "repository": {
                "name": "test-repo",
                "full_name": "test-org/test-repo",
                "owner": {"login": "test-org"},
            },
            "installation": {"id": 12345},
        }

        body = json.dumps(payload).encode("utf-8")
        signature = create_signature(body, "test-secret")

        with patch("src.api.routes.github.verify_webhook_signature") as mock_verify:
            mock_verify.return_value = True

            with patch("src.api.routes.github.get_installation_token") as mock_token:
                mock_token.return_value = "ghs_test_token"

                response = client.post(
                    "/api/github/webhook",
                    content=body,
                    headers={
                        "X-GitHub-Event": "issues",
                        "X-Hub-Signature-256": signature,
                        "Content-Type": "application/json",
                    },
                )

                assert response.status_code == 200
                assert response.json()["status"] == "Processing issue event"

    def test_webhook_invalid_signature(self):
        """Should reject invalid signature."""
        payload = {"action": "opened"}
        body = json.dumps(payload).encode("utf-8")

        with patch("src.api.routes.github.verify_webhook_signature") as mock_verify:
            mock_verify.return_value = False

            response = client.post(
                "/api/github/webhook",
                content=body,
                headers={
                    "X-GitHub-Event": "issues",
                    "X-Hub-Signature-256": "sha256=invalid",
                    "Content-Type": "application/json",
                },
            )

            assert response.status_code == 401

    def test_webhook_non_issue_event(self):
        """Should ignore non-issue events."""
        payload = {"action": "closed"}
        body = json.dumps(payload).encode("utf-8")
        signature = create_signature(body, "test-secret")

        with patch("src.api.routes.github.verify_webhook_signature") as mock_verify:
            mock_verify.return_value = True

            response = client.post(
                "/api/github/webhook",
                content=body,
                headers={
                    "X-GitHub-Event": "push",
                    "X-Hub-Signature-256": signature,
                    "Content-Type": "application/json",
                },
            )

            assert response.status_code == 200
            assert response.json()["status"] == "Event ignored"

    def test_webhook_issue_not_opened(self):
        """Should ignore issue events that are not opened."""
        payload = {"action": "closed", "issue": {"number": 1}}
        body = json.dumps(payload).encode("utf-8")
        signature = create_signature(body, "test-secret")

        with patch("src.api.routes.github.verify_webhook_signature") as mock_verify:
            mock_verify.return_value = True

            response = client.post(
                "/api/github/webhook",
                content=body,
                headers={
                    "X-GitHub-Event": "issues",
                    "X-Hub-Signature-256": signature,
                    "Content-Type": "application/json",
                },
            )

            assert response.status_code == 200
            assert response.json()["status"] == "Event ignored"
