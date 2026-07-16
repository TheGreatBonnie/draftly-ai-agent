from __future__ import annotations

import asyncio
import sys

import structlog

from src.agents.graph import compile_graph
from src.database import close_pool, get_pool

logger = structlog.get_logger()


async def run_workflow(question: str, source: str = "cli", org_id: str = "default"):
    await get_pool()
    graph = await compile_graph()

    initial_state = {
        "org_id": org_id,
        "source": source,
        "channel_id": "cli",
        "thread_id": "cli-test",
        "question": question,
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
        "workflow_id": "",
        "doc_id": "",
        "messages": [],
    }

    config = {"configurable": {"thread_id": f"cli-{hash(question)}"}}

    print(f"\n🔄 Processing: {question}\n")

    result = await graph.ainvoke(initial_state, config)

    print("\n✅ Completed!")
    print(f"Title: {result.get('draft_title', 'N/A')}")
    print(f"Confidence: {result.get('confidence_score', 0):.2f}")
    print(f"Doc Type: {result.get('doc_type', 'N/A')}")

    if result.get("human_decision"):
        print(f"Human Decision: {result['human_decision']}")

    print(f"\n📄 Draft:\n{result.get('draft_content', 'N/A')[:500]}...")

    await close_pool()
    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m src.cli.draftly 'your question here'")
        sys.exit(1)

    question = sys.argv[1]
    asyncio.run(run_workflow(question))


if __name__ == "__main__":
    main()
