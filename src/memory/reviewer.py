from __future__ import annotations

import json
import structlog
from src.database import fetch_one, fetch_all, execute

logger = structlog.get_logger()


async def create_review_session(
    doc_id: str,
    reviewer_id: str | None = None,
    confidence_before: float | None = None,
) -> str:
    row = await fetch_one(
        """
        INSERT INTO review_sessions (doc_id, reviewer_id, confidence_before, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id::text
        """,
        doc_id, reviewer_id, confidence_before,
    )
    logger.info("review_created", id=row["id"], doc_id=doc_id)
    return row["id"]


async def complete_review(
    review_id: str,
    status: str,
    feedback: str | None = None,
    edits_made: dict | None = None,
    confidence_after: float | None = None,
) -> None:
    await execute(
        """
        UPDATE review_sessions
        SET status = $1, reviewer_feedback = $2, edits_made = $3::jsonb,
            confidence_after = $4, completed_at = now()
        WHERE id = $5
        """,
        status, feedback, json.dumps(edits_made or {}), confidence_after, review_id,
    )
    logger.info("review_completed", id=review_id, status=status)


async def get_pending_reviews(org_id: str) -> list[dict]:
    rows = await fetch_all(
        """
        SELECT rs.*, rs.id::text as id, d.title, d.content, d.doc_type, d.confidence_score
        FROM review_sessions rs
        JOIN documentation d ON d.id = rs.doc_id
        WHERE d.org_id = $1 AND rs.status = 'pending'
        ORDER BY rs.created_at DESC
        """,
        org_id,
    )
    return [dict(r) for r in rows]


async def get_review_history(org_id: str, limit: int = 10) -> list[dict]:
    rows = await fetch_all(
        """
        SELECT rs.*, rs.id::text as id, d.title, d.doc_type
        FROM review_sessions rs
        JOIN documentation d ON d.id = rs.doc_id
        WHERE d.org_id = $1 AND rs.status != 'pending'
        ORDER BY rs.completed_at DESC
        LIMIT $2
        """,
        org_id, limit,
    )
    return [dict(r) for r in rows]


async def get_reviewer_memory(org_id: str, limit: int = 10) -> list[dict]:
    rows = await fetch_all(
        """
        SELECT * FROM agent_memory
        WHERE org_id = $1 AND memory_type = 'reviewer'
        ORDER BY created_at DESC
        LIMIT $2
        """,
        org_id, limit,
    )
    return [dict(r) for r in rows]
