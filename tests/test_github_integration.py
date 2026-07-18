"""Tests for GitHub integration in publish node."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.agents.nodes.publish import _post_to_github


class TestPostToGithub:
    """Tests for posting to GitHub."""

    @pytest.mark.asyncio
    async def test_post_to_github_skips_invalid_channel(self):
        """Should skip posting for invalid channel format."""
        state = {
            "source": "github",
            "channel_id": "invalid",
            "thread_id": "1",
        }

        # Should not raise, just skip
        await _post_to_github(state, [])

    @pytest.mark.asyncio
    async def test_post_to_github_skips_missing_org(self):
        """Should skip posting if org not found."""
        state = {
            "source": "github",
            "channel_id": "test-org/test-repo",
            "thread_id": "1",
        }

        with patch("src.agents.nodes.publish.get_org_by_github") as mock_get_org:
            mock_get_org.return_value = None

            await _post_to_github(state, [])

            mock_get_org.assert_called_once_with("test-org")
