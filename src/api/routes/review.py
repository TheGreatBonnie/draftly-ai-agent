from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class QuickAction(BaseModel):
    feedback: str = ""


@router.get("/{token}")
async def get_review_by_token(token: str):
    """Verify token and return review details."""
    from src.security.tokens import verify_review_token
    from src.memory.reviewers import get_reviewer_by_id
    from src.memory.reviewer import get_pending_reviews

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


@router.post("/{token}/action")
async def execute_quick_action(token: str, action: str, body: QuickAction):
    """Execute approve/reject/revise action via token."""
    from src.security.tokens import verify_review_token
    from src.memory.reviewers import get_reviewer_by_id
    from src.memory.reviewer import complete_review

    if action not in ("approve", "reject", "revise"):
        raise HTTPException(status_code=400, detail="Invalid action")

    payload = verify_review_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    reviewer = await get_reviewer_by_id(payload["reviewer_id"])
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    status_map = {
        "approve": "approved",
        "reject": "rejected",
        "revise": "needs_changes",
    }

    await complete_review(
        review_id=payload["review_id"],
        status=status_map[action],
        feedback=body.feedback,
    )

    return {"status": "success", "action": action}
