from __future__ import annotations

import structlog

from src.agents.state import DocumentationState
from src.memory.episodic import create_thread
from src.memory.organizational import store_audit_log

logger = structlog.get_logger()


async def ingest_node(state: DocumentationState) -> dict:
    org_id = state["org_id"]
    source = state["source"]
    channel_id = state["channel_id"]
    thread_id = state["thread_id"]
    question = state["question"]

    logger.info("ingest_started", org_id=org_id, source=source, thread_id=thread_id)

    # Create support thread record
    st_id = await create_thread(
        org_id=org_id,
        source=source,
        channel_id=channel_id,
        thread_id=thread_id,
        title=question[:200] if question else None,
        question_summary=question,
    )

    # Audit log
    await store_audit_log(
        org_id=org_id,
        actor="agent",
        action="ingest_message",
        resource_type="support_thread",
        resource_id=st_id,
        details={"source": source, "thread_id": thread_id, "question": question[:500]},
    )

    logger.info("ingest_completed", thread_record_id=st_id)

    return {
        "support_thread_id": st_id,
        "similar_threads": [],
        "existing_docs": [],
        "reviewer_feedback_history": [],
        "semantic_context": [],
        "web_context": [],
        "doc_context": [],
        "knowledge_package": {},
        "draft_content": "",
        "draft_title": "",
        "doc_type": "howto",
        "confidence_score": 0.0,
        "review_result": {},
        "review_feedback": "",
        "human_decision": "",
        "human_feedback": "",
        "published_urls": [],
        "messages": [],
    }
