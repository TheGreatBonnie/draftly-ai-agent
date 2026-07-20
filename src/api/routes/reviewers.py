from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.auth import get_verified_token, require_admin_role
from src.memory.reviewers import (
    create_reviewer,
    delete_reviewer,
    get_reviewer_by_id,
    get_reviewers_by_org,
    update_reviewer,
)

router = APIRouter()


class CreateReviewerRequest(BaseModel):
    org_id: str | None = None
    name: str
    email: str | None = None
    slack_user_id: str | None = None
    discord_user_id: str | None = None
    notify_slack: bool = True
    notify_discord: bool = False
    notify_email: bool = False


class UpdateReviewerRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    slack_user_id: str | None = None
    discord_user_id: str | None = None
    notify_slack: bool | None = None
    notify_discord: bool | None = None
    notify_email: bool | None = None
    is_active: bool | None = None


@router.post("")
async def create(request: CreateReviewerRequest, token: dict = Depends(require_admin_role)):
    """Create a new reviewer."""
    org_id = token.get("org_id") or request.org_id
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")
    reviewer = await create_reviewer(
        org_id=org_id,
        name=request.name,
        email=request.email,
        slack_user_id=request.slack_user_id,
        discord_user_id=request.discord_user_id,
        notify_slack=request.notify_slack,
        notify_discord=request.notify_discord,
        notify_email=request.notify_email,
    )
    return reviewer


@router.get("")
async def list_reviewers(token: dict = Depends(get_verified_token), org_id: str | None = None, active_only: bool = True):
    """List reviewers for the current organization."""
    effective_org = org_id or token.get("org_id")
    if not effective_org:
        return {"reviewers": []}
    reviewers = await get_reviewers_by_org(effective_org, active_only=active_only)
    return {"reviewers": reviewers}


@router.get("/{reviewer_id}")
async def get_reviewer(reviewer_id: str, token: dict = Depends(get_verified_token)):
    """Get a reviewer by ID."""
    reviewer = await get_reviewer_by_id(reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    return reviewer


@router.put("/{reviewer_id}")
async def update(reviewer_id: str, request: UpdateReviewerRequest, token: dict = Depends(require_admin_role)):
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
async def delete(reviewer_id: str, token: dict = Depends(require_admin_role)):
    """Delete a reviewer."""
    existing = await get_reviewer_by_id(reviewer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    await delete_reviewer(reviewer_id)
    return {"status": "deleted"}
