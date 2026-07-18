from __future__ import annotations

import structlog
from langgraph.types import interrupt

from src.agents.state import DocumentationState
from src.config import settings
from src.memory.organizational import store_audit_log
from src.memory.reviewer import create_review_session

logger = structlog.get_logger()


async def notify_human_reviewers(state: DocumentationState, review_id: str):
    """Send notifications to Slack/Discord when human review is needed."""
    import httpx

    title = state.get("draft_title", "Untitled")
    question = state["question"]
    confidence = state.get("confidence_score", 0)
    source = state.get("source_type", "unknown")

    message = (
        f"📝 *Documentation Review Required*\n\n"
        f"*Title:* {title}\n"
        f"*Source:* {source}\n"
        f"*Confidence:* {confidence:.0%}\n"
        f"*Original Question:* {question[:200]}{'...' if len(question) > 200 else ''}\n\n"
        f"Review this document in the dashboard to approve or request changes."
    )

    results = {}

    # Post to Slack
    if settings.slack_bot_token:
        try:
            token = settings.slack_bot_token.get_secret_value()
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://slack.com/api/chat.postMessage",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"channel": "reviews", "text": message, "mrkdwn": True},
                    timeout=10,
                )
                data = resp.json()
                results["slack"] = {"ok": data.get("ok", False)}
        except Exception as e:
            logger.error("slack_notification_failed", error=str(e))

    # Post to Discord
    if settings.discord_bot_token:
        try:
            token = settings.discord_bot_token.get_secret_value()
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"https://discord.com/api/v10/channels/reviews/messages",
                    headers={"Authorization": f"Bot {token}"},
                    json={"content": message},
                    timeout=10,
                )
                data = resp.json()
                results["discord"] = {"id": data.get("id")}
        except Exception as e:
            logger.error("discord_notification_failed", error=str(e))

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

    notification_results = await notify_human_reviewers(state, review_id)
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
