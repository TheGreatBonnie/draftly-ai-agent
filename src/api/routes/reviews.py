from __future__ import annotations

import structlog
from fastapi import APIRouter
from pydantic import BaseModel

logger = structlog.get_logger()

router = APIRouter()


class ReviewDecision(BaseModel):
    decision: str  # approve, reject, revise
    feedback: str = ""


DECISION_TO_STATUS = {
    "approve": "approved",
    "reject": "rejected",
    "revise": "needs_changes",
}


@router.get("/pending")
async def get_pending():
    from src.memory.organizations import get_or_create_default_org
    from src.memory.reviewer import get_pending_reviews

    org_id = await get_or_create_default_org()
    return await get_pending_reviews(org_id=org_id)


@router.post("/{review_id}/decide")
async def decide_review(review_id: str, body: ReviewDecision):
    from src.memory.reviewer import complete_review

    await complete_review(
        review_id=review_id,
        status=DECISION_TO_STATUS.get(body.decision, body.decision),
        feedback=body.feedback,
    )

    try:
        from src.agents.runners.resume import resume_review

        await resume_review(
            review_id=review_id,
            decision=body.decision,
            feedback=body.feedback or "",
        )
    except Exception as e:
        logger.error(
            "graph_resume_failed",
            review_id=review_id,
            error=str(e),
        )

    return {"status": "ok", "decision": body.decision}


@router.get("/{review_id}")
async def get_review(review_id: str):
    from src.database import fetch_one

    row = await fetch_one(
        "SELECT rs.*, rs.id::text as id, d.title, d.content, d.doc_type, d.confidence_score "
        "FROM review_sessions rs JOIN documentation d ON d.id = rs.doc_id WHERE rs.id = $1",
        review_id,
    )
    return dict(row) if row else {"error": "not found"}
