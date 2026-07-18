import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from src.agents.nodes.human import notify_human_reviewers


@pytest.mark.asyncio
async def test_notify_human_reviewers():
    """Test sending notifications to Slack and Discord."""
    state = {
        "org_id": "test-org",
        "draft_title": "Test Documentation",
        "question": "How do I configure webhooks?",
        "confidence_score": 0.75,
        "source_type": "github_issue",
    }

    mock_response = MagicMock()
    mock_response.json.return_value = {"ok": True, "id": "123"}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("src.agents.nodes.human.settings") as mock_settings:
        mock_settings.slack_bot_token = MagicMock()
        mock_settings.slack_bot_token.get_secret_value.return_value = "test-token"
        mock_settings.discord_bot_token = MagicMock()
        mock_settings.discord_bot_token.get_secret_value.return_value = "test-token"

        with patch("httpx.AsyncClient", return_value=mock_client):
            results = await notify_human_reviewers(state, "review-123")

            assert "slack" in results
            assert "discord" in results


@pytest.mark.asyncio
async def test_notify_handles_slack_failure():
    """Test notification continues even if Slack fails."""
    state = {
        "org_id": "test-org",
        "draft_title": "Test",
        "question": "Test question",
        "confidence_score": 0.5,
        "source_type": "manual",
    }

    call_count = 0

    async def mock_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise Exception("Slack error")
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"id": "123"}
        return mock_resp

    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("src.agents.nodes.human.settings") as mock_settings:
        mock_settings.slack_bot_token = MagicMock()
        mock_settings.slack_bot_token.get_secret_value.return_value = "test-token"
        mock_settings.discord_bot_token = MagicMock()
        mock_settings.discord_bot_token.get_secret_value.return_value = "test-token"

        with patch("httpx.AsyncClient", return_value=mock_client):
            results = await notify_human_reviewers(state, "review-123")

            assert "slack" not in results
            assert "discord" in results
