from unittest.mock import AsyncMock, patch

import pytest

from src.agents.nodes.human import notify_reviewers

_REVIEWERS_MOD = "src.memory.reviewers"
_SLACK_MOD = "src.integrations.slack"
_DISCORD_MOD = "src.integrations.discord"
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


@pytest.mark.asyncio
@patch(f"{_REVIEWERS_MOD}.get_reviewers_by_org", new_callable=AsyncMock)
@patch(f"{_SLACK_MOD}.send_slack_message", new_callable=AsyncMock)
@patch("src.security.tokens.generate_review_token")
async def test_notify_reviewers_sends_block_kit_card(
    mock_token, mock_slack, mock_get
):
    """Test notify_reviewers sends Block Kit card with blocks parameter."""
    mock_token.return_value = "test_token"
    mock_get.return_value = [
        {
            "id": "rev1",
            "name": "Test Reviewer",
            "notify_slack": True,
            "notify_discord": False,
            "notify_email": False,
            "slack_user_id": "U123",
        }
    ]
    mock_slack.return_value = {"ok": True}

    state = {
        "org_id": "org1",
        "draft_title": "Test Doc",
        "draft_content": "# Test\n\nThis is test content.",
        "confidence_score": 0.85,
        "source_type": "github",
    }

    await notify_reviewers(state, "review123")

    mock_slack.assert_called_once()
    call_args, call_kwargs = mock_slack.call_args
    assert call_args[0] == "U123"
    assert call_args[1].startswith("Documentation Review Required:")
    assert call_kwargs["blocks"] is not None
    assert len(call_kwargs["blocks"]) > 0


@pytest.mark.asyncio
@patch(f"{_REVIEWERS_MOD}.get_reviewers_by_org", new_callable=AsyncMock)
@patch(f"{_DISCORD_MOD}.send_discord_message", new_callable=AsyncMock)
@patch("src.security.tokens.generate_review_token")
async def test_notify_reviewers_sends_discord_embed(mock_token, mock_discord, mock_get):
    """Test notify_reviewers sends Discord embed with components."""
    mock_token.return_value = "discord_token_abc"
    mock_get.return_value = [
        {
            "id": "rev1",
            "name": "Discord Reviewer",
            "notify_slack": False,
            "notify_discord": True,
            "notify_email": False,
            "discord_user_id": "987654321",
        }
    ]
    mock_discord.return_value = {"id": "msg1"}

    state = {
        "org_id": "org1",
        "draft_title": "SSO Guide",
        "draft_content": "# SSO\n\nSetup instructions.",
        "confidence_score": 0.9,
        "source_type": "slack",
    }

    await notify_reviewers(state, "review456")

    mock_discord.assert_called_once()
    call_args, call_kwargs = mock_discord.call_args
    assert call_args[0] == "987654321"
    assert call_kwargs["embed"] is not None
    assert call_kwargs["embed"]["title"] == "Documentation Review Required"
    assert call_kwargs["embed"]["color"] == 49407
    assert call_kwargs["components"] is not None
    assert len(call_kwargs["components"]) == 2


@pytest.mark.asyncio
@patch(f"{_REVIEWERS_MOD}.get_reviewers_by_org", new_callable=AsyncMock)
@patch(f"{_DISCORD_MOD}.send_discord_message", new_callable=AsyncMock)
@patch("src.security.tokens.generate_review_token")
async def test_notify_reviewers_discord_token_in_custom_id(mock_token, mock_discord, mock_get):
    """Test Discord embed components contain the review token."""
    mock_token.return_value = "verify_token_xyz"
    mock_get.return_value = [
        {
            "id": "rev2",
            "name": "Reviewer 2",
            "notify_slack": False,
            "notify_discord": True,
            "notify_email": False,
            "discord_user_id": "111222333",
        }
    ]
    mock_discord.return_value = {"id": "msg2"}

    state = {
        "org_id": "org1",
        "draft_title": "Doc",
        "confidence_score": 0.5,
        "source_type": "github",
    }

    await notify_reviewers(state, "review789")

    _, call_kwargs = mock_discord.call_args
    components = call_kwargs["components"]
    buttons = components[0]["components"]
    for btn in buttons:
        assert "verify_token_xyz" in btn["custom_id"]
    select = components[1]["components"][0]
    assert "verify_token_xyz" in select["custom_id"]
