"""Tests for GitHub pipeline runner."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.agents.runners.github_runner import build_github_state


class TestBuildGithubState:
    """Tests for building GitHub issue state."""

    def test_build_github_state_basic(self):
        """Should build state from GitHub issue payload."""
        payload = {
            "issue": {
                "number": 1,
                "title": "Test Issue",
                "body": "This is a test issue body",
            },
            "repository": {
                "name": "test-repo",
                "full_name": "test-org/test-repo",
                "owner": {"login": "test-org"},
            },
        }

        state = build_github_state(payload=payload, org_id="org-123")

        assert state["org_id"] == "org-123"
        assert state["source"] == "github"
        assert state["channel_id"] == "test-org/test-repo"
        assert state["thread_id"] == "1"
        assert "Test Issue" in state["question"]
        assert "This is a test issue body" in state["question"]

    def test_build_github_state_no_body(self):
        """Should handle issue with no body."""
        payload = {
            "issue": {
                "number": 1,
                "title": "Test Issue",
                "body": None,
            },
            "repository": {
                "name": "test-repo",
                "full_name": "test-org/test-repo",
                "owner": {"login": "test-org"},
            },
        }

        state = build_github_state(payload=payload, org_id="org-123")

        assert "Test Issue" in state["question"]

    def test_build_github_state_initializes_defaults(self):
        """Should initialize all fields to defaults."""
        payload = {
            "issue": {
                "number": 1,
                "title": "Test",
                "body": "Body",
            },
            "repository": {
                "name": "repo",
                "full_name": "org/repo",
                "owner": {"login": "org"},
            },
        }

        state = build_github_state(payload=payload, org_id="org-123")

        assert state["similar_threads"] == []
        assert state["existing_docs"] == []
        assert state["reviewer_feedback_history"] == []
        assert state["semantic_context"] == []
        assert state["github_context"] == []
        assert state["slack_context"] == []
        assert state["knowledge_package"] == {}
        assert state["draft_content"] == ""
        assert state["draft_title"] == ""
        assert state["doc_type"] == "howto"
        assert state["confidence_score"] == 0.0
        assert state["human_decision"] == ""
