from __future__ import annotations

from typing import Annotated, Literal, TypedDict

from langgraph.graph.message import add_messages


class DocumentationState(TypedDict):
    # Input
    org_id: str
    source: Literal["slack", "discord", "github"]
    channel_id: str
    thread_id: str
    question: str

    # Memory retrieval results
    similar_threads: list[dict]
    existing_docs: list[dict]
    reviewer_feedback_history: list[dict]
    semantic_context: list[dict]

    # Research results
    github_context: list[dict]
    slack_context: list[dict]

    # Synthesis
    knowledge_package: dict

    # Documentation output
    draft_content: str
    draft_title: str
    doc_type: str
    confidence_score: float

    # Review
    review_result: dict
    review_feedback: str

    # HITL
    human_decision: Literal["approve", "reject", "revise", ""]
    human_feedback: str

    # Final
    published_urls: list[dict]

    # Tracking
    workflow_id: str
    doc_id: str
    messages: Annotated[list, add_messages]
