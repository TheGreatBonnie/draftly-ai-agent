from __future__ import annotations

import asyncio
import json

import structlog

from src.agents.state import DocumentationState
from src.agents.tools.github_tools import search_github_issues
from src.agents.tools.slack_tools import search_slack_messages

logger = structlog.get_logger()


async def research_node(state: DocumentationState) -> dict:
    question = state["question"]
    org_id = state["org_id"]

    logger.info("research_started", org_id=org_id)

    github_task = search_github_issues.ainvoke(
        {
            "query": question,
            "org": "",
            "limit": 5,
        }
    )
    slack_task = search_slack_messages.ainvoke(
        {
            "query": question,
            "limit": 5,
        }
    )

    github_result, slack_result = await asyncio.gather(
        github_task, slack_task, return_exceptions=True
    )

    github_context = (
        [github_result] if not isinstance(github_result, Exception) else [f"Error: {github_result}"]
    )
    slack_context = (
        [slack_result] if not isinstance(slack_result, Exception) else [f"Error: {slack_result}"]
    )

    logger.info("research_completed", github=len(github_context), slack=len(slack_context))

    return {
        "github_context": github_context,
        "slack_context": slack_context,
    }


async def research_node_hybrid(state: DocumentationState) -> dict:
    """Enhanced research node with subagent patterns and parallel execution."""
    from src.agents.subagents import research_analyst_subagent
    from src.agents.skills import get_skill_for_question
    from src.agents.planners.investigation import create_investigation_plan

    question = state["question"]
    org_id = state["org_id"]

    logger.info("research_hybrid_started", org_id=org_id)

    # Get research skill
    research_skill = get_skill_for_question(question, "research")
    
    # Create investigation plan
    investigation_plan = create_investigation_plan(question)

    # Execute standard research
    github_task = search_github_issues.ainvoke(
        {
            "query": question,
            "org": "",
            "limit": 5,
        }
    )
    slack_task = search_slack_messages.ainvoke(
        {
            "query": question,
            "limit": 5,
        }
    )

    github_result, slack_result = await asyncio.gather(
        github_task, slack_task, return_exceptions=True
    )

    github_context = (
        [github_result] if not isinstance(github_result, Exception) else [f"Error: {github_result}"]
    )
    slack_context = (
        [slack_result] if not isinstance(slack_result, Exception) else [f"Error: {slack_result}"]
    )

    logger.info(
        "research_hybrid_completed",
        github=len(github_context),
        slack=len(slack_context),
        skill=research_skill.get("name", "none"),
        plan_tasks=len(investigation_plan),
    )

    return {
        "github_context": github_context,
        "slack_context": slack_context,
        "research_skill": research_skill,
        "investigation_plan": investigation_plan,
    }
