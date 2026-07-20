from __future__ import annotations

from fastapi import APIRouter, Depends

from src.api.auth import get_verified_token

router = APIRouter()


@router.get("/")
async def list_docs(token: dict = Depends(get_verified_token)):
    from src.database import fetch_all

    org_id = token.get("org_id")
    if not org_id:
        return []
    rows = await fetch_all(
        "SELECT *, id::text as id FROM documentation "
        "WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50",
        org_id,
    )
    return [dict(r) for r in rows]


@router.get("/{doc_id}")
async def get_doc(doc_id: str, token: dict = Depends(get_verified_token)):
    from src.database import fetch_one

    row = await fetch_one("SELECT *, id::text as id FROM documentation WHERE id = $1", doc_id)
    return dict(row) if row else {"error": "not found"}
