from __future__ import annotations

import structlog
from langgraph.types import interrupt

from src.agents.state import DocumentationState
from src.memory.organizational import store_audit_log
from src.memory.reviewer import create_review_session

logger = structlog.get_logger()


async def human_review_node(state: DocumentationState) -> dict:
    org_id = state["org_id"]
    doc_id = state.get("doc_id", "")

    logger.info("human_review_started", org_id=org_id, doc_id=doc_id)

    review_id = await create_review_session(
        doc_id=doc_id,
        confidence_before=state.get("confidence_score", 0),
    )

    await store_audit_log(
        org_id=org_id,
        actor="system",
        action="request_human_review",
        resource_type="documentation",
        resource_id=doc_id,
        details={"review_id": review_id, "confidence": state.get("confidence_score", 0)},
    )

    decision = interrupt(
        {
            "type": "documentation_review",
            "doc_id": doc_id,
            "review_id": review_id,
            "title": state.get("draft_title", ""),
            "content": state.get("draft_content", ""),
            "confidence": state.get("confidence_score", 0),
            "question": state["question"],
        }
    )

    human_decision = decision.get("decision", "reject") if isinstance(decision, dict) else "reject"
    human_feedback = decision.get("feedback", "") if isinstance(decision, dict) else ""

    logger.info("human_review_completed", decision=human_decision)

    return {
        "human_decision": human_decision,
        "human_feedback": human_feedback,
    }
