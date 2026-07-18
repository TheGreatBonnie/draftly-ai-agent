from __future__ import annotations

import uuid
from datetime import datetime

import structlog

from src.database import execute, fetch_all, fetch_one

logger = structlog.get_logger()


def _serialize_row(row) -> dict:
    return {
        k: str(v) if isinstance(v, uuid.UUID)
        else v.isoformat() if isinstance(v, datetime)
        else v
        for k, v in dict(row).items()
    }


async def create_reviewer(
    org_id: str,
    name: str,
    email: str | None = None,
    slack_user_id: str | None = None,
    discord_user_id: str | None = None,
    notification_channel: str = "slack",
) -> dict:
    """Create a new reviewer."""
    row = await fetch_one(
        """
        INSERT INTO reviewers (org_id, name, email, slack_user_id, discord_user_id, notification_channel)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        """,
        org_id,
        name,
        email,
        slack_user_id,
        discord_user_id,
        notification_channel,
    )
    logger.info("reviewer_created", id=str(row["id"]), org_id=org_id, name=name)
    return _serialize_row(row)


async def get_reviewers_by_org(
    org_id: str,
    active_only: bool = True,
) -> list[dict]:
    """Get all reviewers for an organization."""
    query = """
        SELECT * FROM reviewers
        WHERE org_id = $1
    """
    if active_only:
        query += " AND is_active = true"
    query += " ORDER BY created_at DESC"

    rows = await fetch_all(query, org_id)
    return [_serialize_row(r) for r in rows]


async def get_reviewer_by_id(reviewer_id: str) -> dict | None:
    """Get a reviewer by ID."""
    row = await fetch_one(
        "SELECT * FROM reviewers WHERE id = $1",
        reviewer_id,
    )
    return _serialize_row(row) if row else None


async def update_reviewer(
    reviewer_id: str,
    name: str | None = None,
    email: str | None = None,
    slack_user_id: str | None = None,
    discord_user_id: str | None = None,
    notification_channel: str | None = None,
    is_active: bool | None = None,
) -> dict | None:
    """Update a reviewer."""
    updates = []
    params = []
    param_idx = 1

    if name is not None:
        updates.append(f"name = ${param_idx}")
        params.append(name)
        param_idx += 1
    if email is not None:
        updates.append(f"email = ${param_idx}")
        params.append(email)
        param_idx += 1
    if slack_user_id is not None:
        updates.append(f"slack_user_id = ${param_idx}")
        params.append(slack_user_id)
        param_idx += 1
    if discord_user_id is not None:
        updates.append(f"discord_user_id = ${param_idx}")
        params.append(discord_user_id)
        param_idx += 1
    if notification_channel is not None:
        updates.append(f"notification_channel = ${param_idx}")
        params.append(notification_channel)
        param_idx += 1
    if is_active is not None:
        updates.append(f"is_active = ${param_idx}")
        params.append(is_active)
        param_idx += 1

    if not updates:
        return await get_reviewer_by_id(reviewer_id)

    updates.append("updated_at = now()")
    params.append(reviewer_id)

    query = f"""
        UPDATE reviewers
        SET {', '.join(updates)}
        WHERE id = ${param_idx}
        RETURNING *
    """

    row = await fetch_one(query, *params)
    if row:
        logger.info("reviewer_updated", id=reviewer_id)
        return _serialize_row(row)
    return None


async def delete_reviewer(reviewer_id: str) -> bool:
    """Soft delete a reviewer by setting is_active to false."""
    result = await execute(
        "UPDATE reviewers SET is_active = false, updated_at = now() WHERE id = $1",
        reviewer_id,
    )
    logger.info("reviewer_deleted", id=reviewer_id)
    return True


async def get_active_reviewer_ids(org_id: str) -> list[str]:
    """Get all active reviewer IDs for an organization."""
    rows = await fetch_all(
        "SELECT id::text FROM reviewers WHERE org_id = $1 AND is_active = true",
        org_id,
    )
    return [str(row["id"]) for row in rows]
