from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.auth import get_verified_token
from src.database import execute, fetch_all, fetch_one
from src.memory.vector_store import store_embedding

router = APIRouter()


class IngestKnowledgeRequest(BaseModel):
    title: str
    content: str
    doc_type: str = "reference"


@router.post("")
async def ingest_knowledge(
    request: IngestKnowledgeRequest,
    token: dict = Depends(get_verified_token),
):
    """Ingest a company document into the knowledge base."""
    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    if request.doc_type not in ("howto", "faq", "tutorial", "troubleshooting", "reference"):
        raise HTTPException(
            status_code=400,
            detail="doc_type must be one of: howto, faq, tutorial, troubleshooting, reference",
        )

    row = await fetch_one(
        """
        INSERT INTO documentation
            (org_id, title, content, doc_type, status, confidence_score)
        VALUES ($1, $2, $3, $4, 'approved', 1.0)
        RETURNING id::text
        """,
        org_id,
        request.title,
        request.content,
        request.doc_type,
    )
    assert row is not None
    doc_id = row["id"]

    await store_embedding(
        org_id=org_id,
        content_type="documentation",
        content_id=doc_id,
        content_text=f"{request.title}\n\n{request.content}",
        metadata={"source": "knowledge_upload", "doc_type": request.doc_type},
    )

    return {"id": doc_id, "title": request.title, "status": "approved"}


@router.get("")
async def list_knowledge(token: dict = Depends(get_verified_token)):
    """List all company knowledge documents."""
    org_id = token.get("org_id")
    if not org_id:
        return []

    rows = await fetch_all(
        "SELECT id::text, title, content, doc_type, version, status, "
        "confidence_score, created_at, updated_at "
        "FROM documentation WHERE org_id = $1 AND status = 'approved' "
        "ORDER BY created_at DESC",
        org_id,
    )
    return [dict(r) for r in rows]


@router.delete("/{doc_id}")
async def delete_knowledge(doc_id: str, token: dict = Depends(get_verified_token)):
    """Delete a knowledge document and its embedding."""
    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    existing = await fetch_one(
        "SELECT id::text FROM documentation WHERE id = $1 AND org_id = $2",
        doc_id,
        org_id,
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")

    await execute("DELETE FROM embeddings WHERE content_id = $1 AND content_type = 'documentation'", doc_id)
    await execute("DELETE FROM documentation WHERE id = $1", doc_id)

    return {"status": "deleted"}
