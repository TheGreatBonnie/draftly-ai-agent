from __future__ import annotations

import structlog

from src.agents.state import DocumentationState

logger = structlog.get_logger()


async def research_node_hybrid(state: DocumentationState) -> dict:
    """Enhanced research node with subagent patterns and parallel execution."""
    from deepagents import create_deep_agent

    from src.agents.planners.investigation import create_investigation_plan
    from src.agents.skills import get_skill_for_question
    from src.agents.subagents import research_analyst_subagent
    from src.config import settings

    question = state["question"]
    org_id = state["org_id"]

    logger.info("research_hybrid_started", org_id=org_id)

    # Get research skill
    research_skill = get_skill_for_question(question, "research")

    # Create investigation plan
    investigation_plan = create_investigation_plan(question)

    # Create deep agent with research subagent
    agent = create_deep_agent(
        model=settings.deepagents_model,
        system_prompt=(
            "You are a research coordinator. Use the research-analyst subagent "
            "to search the web for documentation, tutorials, and articles. "
            "Synthesize findings into a comprehensive research summary."
        ),
        subagents=[research_analyst_subagent],
    )

    # Build research prompt with skill guidance
    skill_strategy = research_skill.get("strategy", {})
    research_focus = skill_strategy.get("focus", "general research")

    prompt = (
        "Research the following question and return a comprehensive summary:\n\n"
        f"Question: {question}\n\n"
        f"Research focus: {research_focus}\n\n"
        "Investigation plan tasks:\n"
    )
    for i, task in enumerate(investigation_plan[:5], 1):
        prompt += f"{i}. {task.get('description', task.get('task', 'Unknown'))}\n"

    # Invoke agent - it will use task tool to delegate to research-analyst
    result = await agent.ainvoke({
        "messages": [{"role": "user", "content": prompt}],
    })

    # Extract results from messages
    messages = result.get("messages", [])
    last_message = messages[-1].content if messages else ""

    # Collect web search results from tool calls
    web_results = []
    for msg in messages:
        if hasattr(msg, "tool_call_id"):  # Tool message
            content = msg.content if isinstance(msg.content, str) else str(msg.content)
            web_results.append(content)

    # Use the final message as research summary if no tool results
    if not web_results:
        web_results = [last_message] if last_message else []

    logger.info(
        "research_hybrid_completed",
        web_results=len(web_results),
        skill=research_skill.get("name", "none"),
        plan_tasks=len(investigation_plan),
    )

    return {
        "github_context": [],
        "slack_context": [],
        "research_skill": research_skill,
        "investigation_plan": investigation_plan,
        "subagent_results": {
            "summary": last_message,
            "web_results": web_results,
        },
    }
