from __future__ import annotations

import asyncio

import structlog

from src.agents.state import DocumentationState
from src.agents.tools.web_tools import search_documentation, search_web

logger = structlog.get_logger()


async def research_node(state: DocumentationState) -> dict:
    question = state["question"]
    org_id = state["org_id"]

    logger.info("research_started", org_id=org_id)

    web_task = search_web.ainvoke(
        {
            "query": question,
            "limit": 10,
        }
    )
    doc_task = search_documentation.ainvoke(
        {
            "query": question,
            "limit": 5,
        }
    )

    web_result, doc_result = await asyncio.gather(
        web_task, doc_task, return_exceptions=True
    )

    web_context = (
        [web_result] if not isinstance(web_result, Exception) else [f"Error: {web_result}"]
    )
    doc_context = (
        [doc_result] if not isinstance(doc_result, Exception) else [f"Error: {doc_result}"]
    )

    logger.info("research_completed", web=len(web_context), doc=len(doc_context))

    return {
        "web_context": web_context,
        "doc_context": doc_context,
    }
