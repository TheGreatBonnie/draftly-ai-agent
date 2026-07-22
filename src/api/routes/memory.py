from __future__ import annotations

from fastapi import APIRouter, Depends

from src.api.auth import get_verified_token

router = APIRouter()


@router.get("/stats")
async def memory_stats(token: dict = Depends(get_verified_token)):
    from src.database import fetch_all

    rows = await fetch_all(
        "SELECT 'support_threads' as name, COUNT(*)::int as count FROM support_threads "
        "UNION ALL SELECT 'documentation', COUNT(*)::int FROM documentation "
        "UNION ALL SELECT 'embeddings', COUNT(*)::int FROM embeddings "
        "UNION ALL SELECT 'review_sessions', COUNT(*)::int FROM review_sessions "
        "UNION ALL SELECT 'agent_memory', COUNT(*)::int FROM agent_memory "
        "UNION ALL SELECT 'audit_logs', COUNT(*)::int FROM audit_logs"
    )
    return {row["name"]: row["count"] for row in rows}


@router.get("/search")
async def search_memory(
    q: str = "",
    type: str = "all",
    token: dict = Depends(get_verified_token),
):
    if not q:
        return []
    from src.memory.vector_store import search_similar

    org_id = token.get("org_id")
    return await search_similar(
        org_id=org_id,
        query_text=q,
        content_type=type if type != "all" else None,
    )
