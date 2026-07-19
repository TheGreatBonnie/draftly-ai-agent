from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.memory.reviewer import complete_review
from src.memory.reviewers import get_reviewer_by_id
from src.security.tokens import verify_review_token

router = APIRouter()


class ReviewActionRequest(BaseModel):
    action: str
    feedback: str = ""


class ReviewActionResponse(BaseModel):
    status: str
    action: str


@router.get("/{token}")
async def get_review_by_token(token: str):
    """Verify token and return review details."""
    payload = verify_review_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    reviewer = await get_reviewer_by_id(payload["reviewer_id"])
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    return {
        "review_id": payload["review_id"],
        "reviewer": reviewer,
        "expires_at": payload["expires_at"],
    }


@router.post("/{token}/action", response_model=ReviewActionResponse)
async def execute_quick_action(token: str, request: ReviewActionRequest):
    """Execute approve/reject/revise action via token."""
    if request.action not in ("approve", "reject", "revise"):
        raise HTTPException(status_code=400, detail="Invalid action")

    payload = verify_review_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    status_map = {
        "approve": "approved",
        "reject": "rejected",
        "revise": "needs_changes",
    }

    await complete_review(
        review_id=payload["review_id"],
        status=status_map[request.action],
        feedback=request.feedback or None,
    )

    return ReviewActionResponse(status="success", action=request.action)
