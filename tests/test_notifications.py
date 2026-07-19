from unittest.mock import AsyncMock, patch

import pytest

from src.agents.nodes.human import notify_reviewers

_REVIEWERS_MOD = "src.memory.reviewers"
_SLACK_MOD = "src.integrations.slack"
_EMAIL_MOD = "src.integrations.email"
_EMAIL = f"{_EMAIL_MOD}.send_review_notification"


@pytest.mark.asyncio
async def test_notify_reviewers_slack():
    """Test notifying reviewers via Slack."""
    state = {
        "org_id": "org-123",
        "draft_title": "Test Doc",
        "confidence_score": 0.75,
        "source_type": "github_issue",
        "question": "How do I configure webhooks?",
    }

    mock_reviewers = [
        {
            "id": "reviewer-1",
            "name": "John",
            "notify_slack": True,
            "notify_discord": False,
            "notify_email": False,
            "slack_user_id": "U123456",
        }
    ]

    with patch(f"{_REVIEWERS_MOD}.get_reviewers_by_org", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_reviewers
        with patch(f"{_SLACK_MOD}.send_slack_message", new_callable=AsyncMock) as mock_slack:
            mock_slack.return_value = {"ok": True}
            results = await notify_reviewers(state, "review-123")
            assert "reviewer-1" in results
            assert results["reviewer-1"]["slack"] == "sent"


@pytest.mark.asyncio
async def test_notify_reviewers_email():
    """Test notifying reviewers via email."""
    state = {
        "org_id": "org-123",
        "draft_title": "Test Doc",
        "confidence_score": 0.75,
        "source_type": "github_issue",
        "question": "How do I configure webhooks?",
    }

    mock_reviewers = [
        {
            "id": "reviewer-1",
            "name": "John",
            "notify_slack": False,
            "notify_discord": False,
            "notify_email": True,
            "email": "john@example.com",
        }
    ]

    with patch(f"{_REVIEWERS_MOD}.get_reviewers_by_org", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_reviewers
        with patch(_EMAIL, new_callable=AsyncMock) as mock_email:
            mock_email.return_value = {"ok": True}
            results = await notify_reviewers(state, "review-123")
            assert "reviewer-1" in results
            assert results["reviewer-1"]["email"] == "sent"


@pytest.mark.asyncio
async def test_notify_handles_failure():
    """Test notification continues even if one reviewer fails."""
    state = {
        "org_id": "org-123",
        "draft_title": "Test Doc",
        "confidence_score": 0.75,
        "source_type": "github_issue",
        "question": "How do I configure webhooks?",
    }

    mock_reviewers = [
        {
            "id": "reviewer-1",
            "name": "John",
            "notify_slack": True,
            "notify_discord": False,
            "notify_email": False,
            "slack_user_id": "U123456",
        },
        {
            "id": "reviewer-2",
            "name": "Jane",
            "notify_slack": False,
            "notify_discord": False,
            "notify_email": True,
            "email": "jane@example.com",
        },
    ]

    with patch(f"{_REVIEWERS_MOD}.get_reviewers_by_org", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_reviewers
        with patch(f"{_SLACK_MOD}.send_slack_message", new_callable=AsyncMock) as mock_slack:
            mock_slack.side_effect = Exception("Slack error")
            with patch(_EMAIL, new_callable=AsyncMock) as mock_email:
                mock_email.return_value = {"ok": True}
                results = await notify_reviewers(state, "review-123")
                assert "reviewer-1" in results
                assert results["reviewer-1"]["status"] == "failed"
                assert "reviewer-2" in results
                assert results["reviewer-2"]["email"] == "sent"
