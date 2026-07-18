from __future__ import annotations

import httpx
import structlog

from src.agents.state import DocumentationState
from src.database import execute
from src.integrations.github_app import get_installation_token
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

    # Post to GitHub if source is github
    if state.get("source") == "github":
        await _post_to_github(state, published_urls)

    logger.info("publish_completed", doc_id=doc_id, title=title)

    return {
        "published_urls": published_urls,
        "human_decision": "",
        "human_feedback": "",
    }


async def _post_to_github(state: DocumentationState, published_urls: list[dict]):
    """Post documentation to GitHub issue as a comment."""
    try:
        # Get installation token from workflow context
        # For now, we'll use a simple approach - this will be enhanced later
        channel_id = state.get("channel_id", "")
        if "/" not in channel_id:
            return

        owner, repo = channel_id.split("/")
        issue_number = state.get("thread_id", "")

        if not issue_number or not owner or not repo:
            return

        # Get installation token (this is a simplified approach)
        # In production, we'd store the installation_id in the workflow
        from src.memory.organizations import get_org_by_github

        org = await get_org_by_github(owner)
        if not org:
            return

        # For now, we'll skip posting if we don't have the installation token
        # This will be enhanced when we have the full workflow context
        logger.info(
            "github_post_skipped",
            owner=owner,
            repo=repo,
            issue_number=issue_number,
            reason="installation_token_not_available",
        )

    except Exception as e:
        logger.error("github_post_failed", error=str(e))
