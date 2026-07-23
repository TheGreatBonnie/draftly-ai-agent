"""Slack webhook routes — Bolt adapter passthrough."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from slack_bolt.adapter.fastapi.async_handler import AsyncSlackRequestHandler

from src.api.auth import get_verified_token
from src.integrations.slack_app import slack_app

router = APIRouter()
handler = AsyncSlackRequestHandler(slack_app)


class LinkSlackRequest(BaseModel):
    team_id: str


@router.post("/events")
async def slack_events(request: Request) -> Response:
    """Handle Slack Events API webhooks (message events, app_mention, etc.)."""
    return await handler.handle(request)


@router.post("/interactivity")
async def slack_interactivity(request: Request) -> Response:
    """Handle Slack interactivity webhooks (button clicks, dropdowns)."""
    return await handler.handle(request)


@router.get("/install")
async def slack_install(request: Request) -> Response:
    """Render 'Add to Slack' button page."""
    return await handler.handle(request)


@router.get("/oauth/callback")
async def slack_oauth_redirect(request: Request) -> Response:
    """Handle OAuth callback from Slack."""
    return await handler.handle(request)


@router.post("/link")
async def link_slack(
    request: LinkSlackRequest,
    token: dict = Depends(get_verified_token),
):
    """Link a Slack installation to the current Clerk organization."""
    from src.memory.organizations import link_slack_installation

    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    await link_slack_installation(team_id=request.team_id, org_id=org_id)
    return {"status": "linked", "team_id": request.team_id}


@router.get("/installations")
async def slack_installations(token: dict = Depends(get_verified_token)):
    from src.memory.organizations import list_slack_installations

    return await list_slack_installations()
