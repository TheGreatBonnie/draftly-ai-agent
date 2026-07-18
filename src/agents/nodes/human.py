from __future__ import annotations

import structlog
from langgraph.types import interrupt

from src.agents.state import DocumentationState
from src.config import settings
from src.memory.organizational import store_audit_log
from src.memory.reviewer import create_review_session
from src.memory.reviewers import get_reviewers_by_org
from src.security.tokens import generate_review_token

logger = structlog.get_logger()


async def notify_reviewers(state: DocumentationState, review_id: str) -> dict:
    """Notify all active org reviewers based on their preferences."""
    from src.integrations.slack import send_slack_message
    from src.integrations.discord import send_discord_message
    from src.integrations.email import send_review_notification

    org_id = state["org_id"]
    reviewers = await get_reviewers_by_org(org_id)
    title = state.get("draft_title", "Untitled")
    confidence = state.get("confidence_score", 0)
    source = state.get("source_type", "unknown")
    question = state["question"]

    results = {}

    for reviewer in reviewers:
        token = generate_review_token(reviewer["id"], review_id)
        dashboard_url = f"{settings.review_dashboard_url}/review/{token}"

        message = (
            f"📝 *Documentation Review Required*\n\n"
            f"*Title:* {title}\n"
            f"*Source:* {source}\n"
            f"*Confidence:* {confidence:.0%}\n\n"
            f"[Review Documentation]({dashboard_url})\n"
            f"Or use: `/approve {token}` | `/reject {token}` | `/revise {token}`"
        )

        try:
            if reviewer["notification_channel"] == "slack" and reviewer.get("slack_user_id"):
                await send_slack_message(reviewer["slack_user_id"], message)
                results[reviewer["id"]] = {"channel": "slack", "status": "sent"}

            elif reviewer["notification_channel"] == "discord" and reviewer.get("discord_user_id"):
                await send_discord_message(reviewer["discord_user_id"], message)
                results[reviewer["id"]] = {"channel": "discord", "status": "sent"}

            elif reviewer["notification_channel"] == "email" and reviewer.get("email"):
                await send_review_notification(
                    to=reviewer["email"],
                    reviewer_name=reviewer["name"],
                    state=state,
                    review_id=review_id,
                    token=token,
                )
                results[reviewer["id"]] = {"channel": "email", "status": "sent"}

        except Exception as e:
            logger.error("notification_failed", reviewer_id=reviewer["id"], error=str(e))
            results[reviewer["id"]] = {"status": "failed", "error": str(e)}

    return results


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

    notification_results = await notify_reviewers(state, review_id)
    logger.info("notifications_sent", results=notification_results)

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
