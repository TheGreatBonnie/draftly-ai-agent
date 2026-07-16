from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_docs():
    from src.database import fetch_all

    rows = await fetch_all(
        "SELECT *, id::text as id FROM documentation "
        "WHERE org_id = 'default' ORDER BY created_at DESC LIMIT 50"
    )
    return [dict(r) for r in rows]


@router.get("/{doc_id}")
async def get_doc(doc_id: str):
    from src.database import fetch_one

    row = await fetch_one("SELECT *, id::text as id FROM documentation WHERE id = $1", doc_id)
    return dict(row) if row else {"error": "not found"}
