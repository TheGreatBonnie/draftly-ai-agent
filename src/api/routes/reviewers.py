from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ReviewerCreate(BaseModel):
    org_id: str
    name: str
    email: str | None = None
    slack_user_id: str | None = None
    discord_user_id: str | None = None
    notification_channel: str = "slack"


class ReviewerUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    slack_user_id: str | None = None
    discord_user_id: str | None = None
    notification_channel: str | None = None
    is_active: bool | None = None


@router.post("")
async def create_reviewer(body: ReviewerCreate):
    from src.memory.reviewers import create_reviewer

    try:
        reviewer = await create_reviewer(
            org_id=body.org_id,
            name=body.name,
            email=body.email,
            slack_user_id=body.slack_user_id,
            discord_user_id=body.discord_user_id,
            notification_channel=body.notification_channel,
        )
        return reviewer
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("")
async def list_reviewers(org_id: str, active_only: bool = True):
    from src.memory.reviewers import get_reviewers_by_org

    reviewers = await get_reviewers_by_org(org_id, active_only)
    return {"reviewers": reviewers, "count": len(reviewers)}


@router.get("/{reviewer_id}")
async def get_reviewer(reviewer_id: str):
    from src.memory.reviewers import get_reviewer_by_id

    reviewer = await get_reviewer_by_id(reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    return reviewer


@router.put("/{reviewer_id}")
async def update_reviewer(reviewer_id: str, body: ReviewerUpdate):
    from src.memory.reviewers import update_reviewer, get_reviewer_by_id

    existing = await get_reviewer_by_id(reviewer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    updated = await update_reviewer(
        reviewer_id=reviewer_id,
        name=body.name,
        email=body.email,
        slack_user_id=body.slack_user_id,
        discord_user_id=body.discord_user_id,
        notification_channel=body.notification_channel,
        is_active=body.is_active,
    )
    return updated


@router.delete("/{reviewer_id}")
async def delete_reviewer(reviewer_id: str):
    from src.memory.reviewers import delete_reviewer, get_reviewer_by_id

    existing = await get_reviewer_by_id(reviewer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    await delete_reviewer(reviewer_id)
    return {"status": "deleted"}
