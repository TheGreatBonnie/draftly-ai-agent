from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.memory.reviewers import (
    create_reviewer,
    delete_reviewer,
    get_reviewer_by_id,
    get_reviewers_by_org,
    update_reviewer,
)

router = APIRouter()


class CreateReviewerRequest(BaseModel):
    org_id: str
    name: str
    email: str | None = None
    slack_user_id: str | None = None
    discord_user_id: str | None = None
    notification_channel: str = "slack"


class UpdateReviewerRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    slack_user_id: str | None = None
    discord_user_id: str | None = None
    notification_channel: str | None = None
    is_active: bool | None = None


@router.post("")
async def create(request: CreateReviewerRequest):
    """Create a new reviewer."""
    reviewer = await create_reviewer(
        org_id=request.org_id,
        name=request.name,
        email=request.email,
        slack_user_id=request.slack_user_id,
        discord_user_id=request.discord_user_id,
        notification_channel=request.notification_channel,
    )
    return reviewer


@router.get("")
async def list_reviewers(org_id: str, active_only: bool = True):
    """List reviewers for an organization."""
    reviewers = await get_reviewers_by_org(org_id, active_only=active_only)
    return {"reviewers": reviewers}


@router.get("/{reviewer_id}")
async def get_reviewer(reviewer_id: str):
    """Get a reviewer by ID."""
    reviewer = await get_reviewer_by_id(reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    return reviewer


@router.put("/{reviewer_id}")
async def update(reviewer_id: str, request: UpdateReviewerRequest):
    """Update a reviewer."""
    existing = await get_reviewer_by_id(reviewer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    updates = request.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = await update_reviewer(reviewer_id, **updates)
    return updated


@router.delete("/{reviewer_id}")
async def delete(reviewer_id: str):
    """Delete a reviewer."""
    existing = await get_reviewer_by_id(reviewer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    await delete_reviewer(reviewer_id)
    return {"status": "deleted"}
