from __future__ import annotations

import structlog
from langgraph.graph import END, StateGraph
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from src.agents.state import DocumentationState
from src.agents.nodes.ingest import ingest_node
from src.agents.nodes.memory import memory_retrieve_node
from src.agents.nodes.research import research_node
from src.agents.nodes.synthesize import synthesize_node
from src.agents.nodes.write import write_docs_node
from src.agents.nodes.review import ai_review_node
from src.agents.nodes.human import human_review_node
from src.agents.nodes.publish import publish_node
from src.config import settings

logger = structlog.get_logger()


def build_graph():
    graph = StateGraph(DocumentationState)

    # Add nodes
    graph.add_node("ingest", ingest_node)
    graph.add_node("memory_retrieve", memory_retrieve_node)
    graph.add_node("research", research_node)
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("write_docs", write_docs_node)
    graph.add_node("ai_review", ai_review_node)
    graph.add_node("human_review", human_review_node)
    graph.add_node("publish", publish_node)

    # Edges
    graph.set_entry_point("ingest")
    graph.add_edge("ingest", "memory_retrieve")
    graph.add_edge("memory_retrieve", "research")
    graph.add_edge("research", "synthesize")
    graph.add_edge("synthesize", "write_docs")
    graph.add_edge("write_docs", "ai_review")

    # Confidence-based routing
    graph.add_conditional_edges(
        "ai_review",
        lambda state: "human_review" if state.get("confidence_score", 0) >= 0.7 else "research",
        {"human_review": "human_review", "research": "research"},
    )

    # HITL routing
    graph.add_conditional_edges(
        "human_review",
        lambda state: {
            "approve": "publish",
            "reject": END,
            "revise": "write_docs",
        }.get(state.get("human_decision", ""), END),
    )

    graph.add_edge("publish", END)

    logger.info("graph_built")
    return graph


async def compile_graph():
    checkpointer = AsyncPostgresSaver.from_conn_string(settings.cockroachdb_url)
    graph = build_graph()
    compiled = graph.compile(checkpointer=checkpointer)
    logger.info("graph_compiled")
    return compiled
