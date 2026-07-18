"""Organization management for multi-tenant support."""

from __future__ import annotations

import structlog

from src.database import fetch_one, fetch_val

logger = structlog.get_logger()


async def get_or_create_org(github_org: str, name: str) -> str:
    """Get or create organization for GitHub repo.

    Args:
        github_org: GitHub organization or user login
        name: Display name for the organization

    Returns:
        Organization ID as string
    """
    # Try to find existing org
    existing = await fetch_one(
        "SELECT id::text FROM organizations WHERE github_org = $1",
        github_org,
    )
    if existing:
        logger.info("org_found", github_org=github_org, org_id=existing["id"])
        return existing["id"]

    # Create new org
    org_id = await fetch_val(
        "INSERT INTO organizations (name, github_org) VALUES ($1, $2) RETURNING id::text",
        name,
        github_org,
    )
    logger.info("org_created", github_org=github_org, org_id=org_id)
    return org_id


async def get_org_by_github(github_org: str) -> dict | None:
    """Find organization by GitHub org name.

    Args:
        github_org: GitHub organization or user login

    Returns:
        Organization dict or None if not found
    """
    result = await fetch_one(
        "SELECT * FROM organizations WHERE github_org = $1",
        github_org,
    )
    return dict(result) if result else None


async def update_org_github_info(
    org_id: str,
    github_org: str,
) -> None:
    """Update organization GitHub info.

    Args:
        org_id: Organization ID
        github_org: GitHub organization or user login
    """
    await fetch_one(
        "UPDATE organizations SET github_org = $1 WHERE id = $2",
        github_org,
        org_id,
    )
    logger.info("org_updated", org_id=org_id, github_org=github_org)
