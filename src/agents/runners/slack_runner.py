"""Slack pipeline runner — orchestrates the Draftly graph for Slack messages."""
from __future__ import annotations

import structlog
from langchain_cockroachdb import AsyncCockroachDBSaver

from src.agents.graph import build_hybrid_graph
from src.agents.state import DocumentationState
from src.config import settings

logger = structlog.get_logger()


def build_slack_state(
    team_id: str,
    channel: str,
    thread_ts: str,
    ts: str,
    text: str,
    user: str,
    org_id: str,
) -> DocumentationState:
    """Build initial DocumentationState from Slack message event."""
    graph_thread_id = f"slack-{channel}-{thread_ts}"

    return {
        "org_id": org_id,
        "source": "slack",
        "channel_id": channel,
        "thread_id": thread_ts,
        "graph_thread_id": graph_thread_id,
        "question": text,
        "similar_threads": [],
        "existing_docs": [],
        "reviewer_feedback_history": [],
        "semantic_context": [],
        "github_context": [],
        "slack_context": [],
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
        "support_thread_id": "",
        "workflow_id": "",
        "doc_id": "",
        "messages": [],
        "source_metadata": {
            "team_id": team_id,
            "channel": channel,
            "thread_ts": thread_ts,
            "ts": ts,
            "user_id": user,
        },
    }


async def run_slack_pipeline(
    team_id: str,
    channel: str,
    thread_ts: str,
    ts: str,
    text: str,
    user: str,
) -> None:
    """Orchestrate the full Draftly pipeline for a Slack support request."""
    from src.database import close_pool, get_pool
    from src.memory.organizations import (
        get_org_by_slack,
        store_slack_workflow,
        update_slack_workflow_status,
    )

    await get_pool()

    try:
        org = await get_org_by_slack(team_id)
        if not org:
            logger.error("slack_pipeline_org_not_found", team_id=team_id)
            return
        org_id = org["id"]

        state = build_slack_state(team_id, channel, thread_ts, ts, text, user, org_id)
        config = {"configurable": {"thread_id": state["graph_thread_id"]}}

        from uuid import uuid4

        workflow_id = str(uuid4())
        await store_slack_workflow(
            org_id=org_id,
            workflow_id=workflow_id,
            channel_id=channel,
            thread_ts=thread_ts,
        )
        await update_slack_workflow_status(workflow_id, "running")

        async with AsyncCockroachDBSaver.from_conn_string(
            settings.cockroachdb_url,
        ) as checkpointer:
            await checkpointer.setup()
            graph = build_hybrid_graph().compile(checkpointer=checkpointer)
            result = await graph.ainvoke(state, config)

        if result.get("human_decision") == "":
            await update_slack_workflow_status(workflow_id, "pending")
            logger.info(
                "slack_pipeline_paused",
                team_id=team_id,
                channel=channel,
                thread_ts=thread_ts,
            )
        else:
            await update_slack_workflow_status(workflow_id, "completed")

    except Exception as e:
        logger.error("slack_pipeline_failed", error=str(e))
        try:
            from src.integrations.slack import send_slack_message

            await send_slack_message(
                channel, f"Error processing request: {e}", thread_ts=ts
            )
        except Exception:
            logger.error("failed_to_post_slack_error")
    finally:
        await close_pool()
