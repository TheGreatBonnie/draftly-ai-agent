from __future__ import annotations

import structlog

from src.agents.state import DocumentationState
from src.database import execute
from src.memory.organizational import store_audit_log, store_memory
from src.memory.vector_store import store_embedding

logger = structlog.get_logger()


async def publish_node(state: DocumentationState) -> dict:
    org_id = state["org_id"]
    doc_id = state.get("doc_id", "")
    content = state.get("draft_content", "")
    title = state.get("draft_title", "")

    logger.info("publish_started", org_id=org_id, doc_id=doc_id)

    await execute(
        "UPDATE documentation SET status = 'approved', updated_at = now() WHERE id = $1",
        doc_id,
    )

    await store_embedding(
        org_id=org_id,
        content_type="documentation",
        content_id=doc_id,
        content_text=f"{title}\n\n{content}",
        metadata={"doc_type": state.get("doc_type"), "confidence": state.get("confidence_score")},
    )

    await store_memory(
        org_id=org_id,
        memory_type="organizational",
        key=title,
        value={
            "doc_id": doc_id,
            "content": content[:1000],
            "doc_type": state.get("doc_type"),
            "confidence": state.get("confidence_score"),
        },
        source="documentation_generation",
        confidence=state.get("confidence_score", 0.5),
    )

    if state.get("human_feedback"):
        await store_memory(
            org_id=org_id,
            memory_type="reviewer",
            key=f"review_{doc_id}",
            value={
                "feedback": state["human_feedback"],
                "decision": state.get("human_decision"),
                "doc_title": title,
            },
            source="human_review",
            confidence=1.0,
        )

    await execute(
        """
        UPDATE support_threads
        SET status = 'resolved', resolution = $1, resolved_at = now()
        WHERE id = $2
        """,
        content[:2000],
        state.get("thread_id"),
    )

    await store_audit_log(
        org_id=org_id,
        actor="agent",
        action="publish_documentation",
        resource_type="documentation",
        resource_id=doc_id,
        details={"title": title, "confidence": state.get("confidence_score")},
    )

    published_urls = [{"platform": "draftly", "doc_id": doc_id}]

    logger.info("publish_completed", doc_id=doc_id, title=title)

    return {
        "published_urls": published_urls,
        "human_decision": "",
        "human_feedback": "",
    }
