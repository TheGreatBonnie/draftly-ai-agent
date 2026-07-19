from __future__ import annotations

from src.agents.runners.github_runner import build_github_state


class TestBuildGithubState:
    """Tests for building GitHub state from payload."""

    def test_build_github_state_basic(self):
        """Test building state from basic GitHub issue payload."""
        payload = {
            "issue": {
                "number": 42,
                "title": "How to configure webhooks?",
                "body": "I need help setting up webhooks in my application.",
            },
            "repository": {
                "full_name": "myorg/myrepo",
                "id": 12345,
            },
        }

        state = build_github_state(payload=payload, org_id="org-123")

        assert state["org_id"] == "org-123"
        assert state["source"] == "github"
        assert state["channel_id"] == "myorg/myrepo"
        assert state["thread_id"] == "42"
        assert "How to configure webhooks?" in state["question"]
        assert "I need help setting up webhooks" in state["question"]

    def test_build_github_state_empty_body(self):
        """Test building state when issue body is empty."""
        payload = {
            "issue": {
                "number": 1,
                "title": "Bug report",
                "body": "",
            },
            "repository": {
                "full_name": "org/repo",
                "id": 100,
            },
        }

        state = build_github_state(payload=payload, org_id="org-456")

        assert state["question"] == "Bug report\n\n"
        assert state["thread_id"] == "1"

    def test_build_github_state_initializes_defaults(self):
        """Test that all required state fields are initialized."""
        payload = {
            "issue": {"number": 1, "title": "Test", "body": "Body"},
            "repository": {"full_name": "org/repo", "id": 1},
        }

        state = build_github_state(payload=payload, org_id="org-1")

        # Check all required fields exist
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
        assert state["review_result"] == {}
        assert state["review_feedback"] == ""
        assert state["human_decision"] == ""
        assert state["human_feedback"] == ""
        assert state["published_urls"] == []
        assert state["messages"] == []
