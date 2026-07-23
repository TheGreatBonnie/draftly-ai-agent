"""Tests for Slack pipeline runner."""
from __future__ import annotations

from src.agents.runners.slack_runner import build_slack_state


class TestBuildSlackState:
    """Tests for building Slack state from message event data."""

    def test_build_slack_state_basic(self) -> None:
        state = build_slack_state(
            team_id="T123",
            channel="C456",
            thread_ts="1234567890.123",
            ts="1234567890.123",
            text="How do I configure webhooks?",
            user="U789",
            org_id="org-1",
        )
        assert state["org_id"] == "org-1"
        assert state["source"] == "slack"
        assert state["channel_id"] == "C456"
        assert state["thread_id"] == "1234567890.123"
        assert state["question"] == "How do I configure webhooks?"

    def test_build_slack_state_source_metadata(self) -> None:
        state = build_slack_state(
            team_id="T123",
            channel="C456",
            thread_ts="999.888",
            ts="999.888",
            text="Help",
            user="U789",
            org_id="org-1",
        )
        metadata = state["source_metadata"]
        assert metadata["team_id"] == "T123"
        assert metadata["channel"] == "C456"
        assert metadata["thread_ts"] == "999.888"
        assert metadata["ts"] == "999.888"
        assert metadata["user_id"] == "U789"

    def test_build_slack_state_initializes_defaults(self) -> None:
        state = build_slack_state(
            team_id="T1",
            channel="C1",
            thread_ts="1.1",
            ts="1.1",
            text="test",
            user="U1",
            org_id="org-1",
        )
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

    def test_build_slack_state_graph_thread_id(self) -> None:
        state = build_slack_state(
            team_id="T99",
            channel="C88",
            thread_ts="777.666",
            ts="777.666",
            text="question",
            user="U55",
            org_id="org-2",
        )
        assert state["graph_thread_id"] == "slack-C88-777.666"
