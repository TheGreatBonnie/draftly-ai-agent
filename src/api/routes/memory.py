from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/stats")
async def memory_stats():
    from src.database import fetch_one

    stats = {}
    tables = [
        "support_threads",
        "documentation",
        "embeddings",
        "review_sessions",
        "agent_memory",
        "audit_logs",
    ]
    for table in tables:
        count = await fetch_one(f"SELECT count(*) FROM {table}")
        stats[table] = count[0] if count else 0
    return stats


@router.get("/search")
async def search_memory(q: str, type: str = "all"):
    from src.memory.vector_store import search_similar

    results = await search_similar(org_id="default", query_text=q, k=10)
    return results
