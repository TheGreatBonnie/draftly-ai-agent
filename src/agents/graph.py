from __future__ import annotations

import structlog
from langgraph.graph import END, StateGraph

from src.agents.nodes.human import human_review_node
from src.agents.nodes.memory import memory_retrieve_node
from src.agents.nodes.publish import publish_node
from src.agents.nodes.synthesize import synthesize_node
from src.agents.nodes.write import write_docs_node
from src.agents.state import DocumentationState

logger = structlog.get_logger()


def build_hybrid_graph():
    """Build enhanced graph with Deep agents capabilities (rubric grading, parallel research)."""
    from src.agents.nodes.ingest import ingest_node_hybrid
    from src.agents.nodes.research import research_node_hybrid
    from src.agents.nodes.review import ai_review_node_hybrid

    graph = StateGraph(DocumentationState)

    # Add hybrid nodes
    graph.add_node("ingest", ingest_node_hybrid)
    graph.add_node("memory_retrieve", memory_retrieve_node)
    graph.add_node("research", research_node_hybrid)
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("write_docs", write_docs_node)
    graph.add_node("ai_review", ai_review_node_hybrid)
    graph.add_node("human_review", human_review_node)
    graph.add_node("publish", publish_node)

    # Edges
    graph.set_entry_point("ingest")
    graph.add_edge("ingest", "memory_retrieve")
    graph.add_edge("memory_retrieve", "research")
    graph.add_edge("research", "synthesize")
    graph.add_edge("synthesize", "write_docs")
    graph.add_edge("write_docs", "ai_review")

    # Rubric-based routing (replaces simple confidence threshold)
    graph.add_conditional_edges(
        "ai_review",
        lambda state: route_by_rubric(state),
        {
            "human_review": "human_review",
            "research": "research",
            "write_docs": "write_docs",
            "publish": "publish",
        },
    )

    # HITL routing (same as standard)
    graph.add_conditional_edges(
        "human_review",
        lambda state: {
            "approve": "publish",
            "reject": END,
            "revise": "write_docs",
        }.get(state.get("human_decision", ""), END),
    )

    graph.add_edge("publish", END)

    logger.info("hybrid_graph_built")
    return graph


def route_by_rubric(state: DocumentationState) -> str:
    """Route based on rubric evaluation results. HITL is always required."""
    rubric_status = state.get("rubric_status", {})

    # If rubric needs revision, loop back
    if rubric_status.get("needs_revision"):
        if rubric_status.get("research_needed"):
            return "research"
        return "write_docs"

    # All other paths go to human_review (always required)
    return "human_review"
