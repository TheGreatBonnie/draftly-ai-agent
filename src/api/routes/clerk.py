from __future__ import annotations

import base64
import hashlib
import hmac

import structlog
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.config import settings
from src.memory.organizations import get_or_create_org_by_clerk
from src.memory.users import (
    add_user_to_org,
    create_clerk_user,
    delete_clerk_user,
    get_org_by_clerk_id,
    remove_user_from_org,
)

logger = structlog.get_logger()

router = APIRouter()


class WebhookResponse(BaseModel):
    status: str


def verify_svix_signature(payload: bytes, headers: dict[str, str]) -> bool:
    """Verify Svix webhook signature (used by Clerk)."""
    svix_id = headers.get("svix-id")
    svix_timestamp = headers.get("svix-timestamp")
    svix_signature = headers.get("svix-signature")

    if not all([svix_id, svix_timestamp, svix_signature]):
        return False

    secret = settings.clerk_signing_secret.get_secret_value()
    to_sign = f"{svix_id}.{svix_timestamp}.{payload.decode()}"
    expected = hmac.new(secret.encode(), to_sign.encode(), hashlib.sha256).digest()
    expected_b64 = base64.b64encode(expected).decode()

    for sig in svix_signature.split(" "):
        if sig.startswith("v1,"):
            received = sig[3:]
            if hmac.compare_digest(received, expected_b64):
                return True
    return False


@router.post("/webhook")
async def clerk_webhook(request: Request) -> WebhookResponse:
    """Receive Clerk webhook events for user and organization lifecycle."""
    body = await request.body()
    headers = dict(request.headers)

    if not verify_svix_signature(body, headers):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json

    payload = json.loads(body)
    event_type = payload.get("type", "")
    data = payload.get("data", {})

    logger.info("clerk_webhook_received", event_type=event_type)

    # ── User events ──
    if event_type == "user.created":
        await create_clerk_user(
            clerk_user_id=data["id"],
            email=data.get("email_addresses", [{}])[0].get("email_address", ""),
            name=f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or "Unknown",
            avatar_url=data.get("profile_image_url", ""),
        )

    elif event_type == "user.deleted":
        await delete_clerk_user(data["id"])

    elif event_type == "user.updated":
        await create_clerk_user(
            clerk_user_id=data["id"],
            email=data.get("email_addresses", [{}])[0].get("email_address", ""),
            name=f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or "Unknown",
            avatar_url=data.get("profile_image_url", ""),
        )

    # ── Organization events ──
    elif event_type == "organization.created":
        await get_or_create_org_by_clerk(
            clerk_org_id=data["id"],
            name=data.get("name", "Unnamed Organization"),
        )

    elif event_type == "organization.deleted":
        org = await get_org_by_clerk_id(data["id"])
        if org:
            from src.database import execute as db_execute

            await db_execute("DELETE FROM organizations WHERE id = $1::uuid", org["id"])
            logger.info("org_deleted_from_clerk", org_id=org["id"])

    elif event_type == "organization.updated":
        org = await get_org_by_clerk_id(data["id"])
        if org:
            from src.database import execute as db_execute

            await db_execute(
                "UPDATE organizations SET name = $1 WHERE id = $2::uuid",
                data.get("name", org["name"]),
                org["id"],
            )

    # ── Membership events ──
    elif event_type == "organizationMembership.created":
        await add_user_to_org(
            clerk_user_id=data["public_user_data"]["user_id"],
            clerk_org_id=data["organization"]["id"],
            role=data.get("role", "org:member"),
        )

    elif event_type == "organizationMembership.deleted":
        await remove_user_from_org(
            clerk_user_id=data["public_user_data"]["user_id"],
            clerk_org_id=data["organization"]["id"],
        )

    elif event_type == "organizationMembership.updated":
        await add_user_to_org(
            clerk_user_id=data["public_user_data"]["user_id"],
            clerk_org_id=data["organization"]["id"],
            role=data.get("role", "org:member"),
        )

    return WebhookResponse(status="ok")
