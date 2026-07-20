from __future__ import annotations

import structlog

from src.agents.state import DocumentationState

logger = structlog.get_logger()


async def research_node_hybrid(state: DocumentationState) -> dict:
    """Research node: runs search_web directly, then synthesizes via call_llm."""
    from src.agents.planners.investigation import create_investigation_plan
    from src.agents.skills import get_skill_for_question
    from src.agents.tools.web_tools import search_web
    from src.config import settings
    from src.integrations.llm import call_llm

    question = state["question"]
    org_id = state["org_id"]

    logger.info("research_hybrid_started", org_id=org_id)

    # Get research skill
    research_skill = get_skill_for_question(question, "research")

    # Create investigation plan
    investigation_plan = create_investigation_plan(question)

    # Execute web searches directly for each plan task
    web_results = []
    for task in investigation_plan[:5]:
        query = task.get("description", task.get("task", question))
        try:
            result = await search_web.ainvoke({"query": query, "max_results": 3})
            web_results.append(result)
        except Exception as e:
            logger.warning("search_failed", query=query, error=str(e))

    # Synthesize findings via LLM
    def _extract_result_text(r: dict) -> str:
        if isinstance(r, dict) and "results" in r:
            items = r["results"]
            if items and isinstance(items[0], dict):
                title = items[0].get("title", "")
                url = items[0].get("url", "")
                content = items[0].get("content", "")
                return f"[{title}]({url})\n{content}"
        return str(r)

    research_context = "\n\n---\n\n".join(
        [_extract_result_text(r) for r in web_results]
    ) if web_results else "No web results found."

    research_focus = research_skill.get("name", "general")

    synthesis_prompt = (
        f"Research the following question and return a comprehensive summary.\n\n"
        f"Question: {question}\n\n"
        f"Research focus: {research_focus}\n\n"
        f"Web search results:\n{research_context}"
    )

    summary = await call_llm(
        prompt=synthesis_prompt,
        system_prompt=(
            "You are a research coordinator. Synthesize the provided web search results "
            "into a comprehensive research summary with key findings, source URLs, "
            "and confidence assessment."
        ),
        model=settings.research_model,
    )

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
            "summary": summary,
            "web_results": web_results,
        },
    }
