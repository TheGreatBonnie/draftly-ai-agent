from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.auth import get_verified_token, require_admin_role, require_reviewer_role
from src.database import fetch_one
from src.memory.reviewers import (
    create_reviewer,
    delete_reviewer,
    get_reviewer_by_clerk_user,
    get_reviewer_by_id,
    get_reviewers_by_org,
    update_reviewer,
)
from src.services import clerk_admin

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


class AssignRoleRequest(BaseModel):
    user_id: str
    role: str


# ── Admin: manage org member roles ──


@router.get("/org-members")
async def list_org_members(token: dict = Depends(require_admin_role)):
    """List Clerk org members with their roles (admin only)."""
    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")
    members = await clerk_admin.list_org_members(org_id)
    return {"members": members}


@router.post("/assign-role")
async def assign_role(request: AssignRoleRequest, token: dict = Depends(require_admin_role)):
    """Assign a role to an org member via Clerk (admin only)."""
    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")
    if request.role not in ("admin", "member", "reviewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    result = await clerk_admin.update_member_role(org_id, request.user_id, request.role)
    return result


# ── Reviewer self-registration ──


@router.post("/self")
async def register_as_reviewer(token: dict = Depends(require_reviewer_role)):
    """Register the current user as a reviewer for their org."""
    org_id = token.get("org_id")
    clerk_user_id = token.get("user_id")
    if not org_id or not clerk_user_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    existing = await get_reviewer_by_clerk_user(org_id, clerk_user_id)
    if existing:
        raise HTTPException(status_code=409, detail="Already registered as reviewer")

    user = await fetch_one(
        "SELECT name, email FROM clerk_users WHERE clerk_user_id = $1",
        clerk_user_id,
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found in database")

    reviewer = await create_reviewer(
        org_id=org_id,
        name=user["name"],
        email=user["email"],
        clerk_user_id=clerk_user_id,
        notify_slack=True,
    )
    return reviewer


# ── Standard CRUD ──


@router.post("")
async def create(request: CreateReviewerRequest, token: dict = Depends(require_admin_role)):
    """Create a new reviewer (admin only)."""
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
async def list_reviewers(
    token: dict = Depends(get_verified_token),
    org_id: str | None = None,
    active_only: bool = True,
):
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
async def update(
    reviewer_id: str,
    request: UpdateReviewerRequest,
    token: dict = Depends(require_admin_role),
):
    """Update a reviewer (admin only)."""
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
    """Delete a reviewer (admin only)."""
    existing = await get_reviewer_by_id(reviewer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    await delete_reviewer(reviewer_id)
    return {"status": "deleted"}
