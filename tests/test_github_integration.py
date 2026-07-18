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
    async def test_post_to_github_posts_comment(self):
        """Should post comment to GitHub issue."""
        state = {
            "source": "github",
            "channel_id": "test-org/test-repo",
            "thread_id": "42",
            "draft_title": "How to Configure Webhooks",
            "draft_content": "# How to Configure Webhooks\n\nStep 1...",
            "doc_type": "howto",
            "confidence_score": 0.85,
        }

        published_urls = []

        with patch("src.agents.nodes.publish.post_github_comment") as mock_post:
            mock_post.return_value = {"html_url": "https://github.com/test-org/test-repo/issues/42#issuecomment-123"}
            
            await _post_to_github(state, published_urls)
            
            mock_post.assert_called_once_with(
                owner="test-org",
                repo="test-repo",
                issue_number=42,
                body=mock_post.call_args[1]["body"],  # Check body is passed
            )
            assert len(published_urls) == 1
            assert published_urls[0]["platform"] == "github"
