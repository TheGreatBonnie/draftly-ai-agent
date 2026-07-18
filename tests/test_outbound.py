import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from src.integrations.outbound import post_to_slack, post_to_discord, post_to_github


@pytest.mark.asyncio
async def test_post_to_slack():
    """Test posting message to Slack."""
    with patch("src.integrations.outbound.settings") as mock_settings:
        mock_settings.slack_bot_token = MagicMock()
        mock_settings.slack_bot_token.get_secret_value.return_value = "test-token"

        mock_response = MagicMock()
        mock_response.json.return_value = {"ok": True, "ts": "1234567890.123456"}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await post_to_slack("C123456", "Test message")
            assert result["ok"] is True


@pytest.mark.asyncio
async def test_post_to_discord():
    """Test posting message to Discord."""
    with patch("src.integrations.outbound.settings") as mock_settings:
        mock_settings.discord_bot_token = MagicMock()
        mock_settings.discord_bot_token.get_secret_value.return_value = "test-token"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "123456"}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await post_to_discord("C123456", "Test message")
            assert result["id"] == "123456"


@pytest.mark.asyncio
async def test_post_to_github():
    """Test posting comment to GitHub issue."""
    with patch("src.integrations.outbound.settings") as mock_settings:
        mock_settings.github_token = MagicMock()
        mock_settings.github_token.get_secret_value.return_value = "test-token"

        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"id": 1}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await post_to_github("owner/repo", 123, "Test comment")
            assert result["id"] == 1
