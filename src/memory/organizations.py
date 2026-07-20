from __future__ import annotations

import structlog

from src.database import fetch_all, fetch_one

logger = structlog.get_logger()


async def get_or_create_default_org(name: str = "default") -> str:
    """Get or create an org by name. Returns clerk_org_id."""
    existing = await fetch_one(
        "SELECT clerk_org_id FROM organizations WHERE name = $1",
        name,
    )
    if existing:
        return existing["clerk_org_id"]

    row = await fetch_one(
        "INSERT INTO organizations (name, clerk_org_id) VALUES ($1, $2) RETURNING clerk_org_id",
        name,
        f"org_{name}",
    )
    logger.info("org_created", name=name, clerk_org_id=row["clerk_org_id"])
    return row["clerk_org_id"]


async def get_or_create_org(github_org: str, name: str | None = None) -> str:
    """Get or create organization for GitHub repo. Returns clerk_org_id."""
    org_name = name or github_org

    existing = await fetch_one(
        "SELECT clerk_org_id FROM organizations WHERE github_org = $1",
        github_org,
    )
    if existing:
        return existing["clerk_org_id"]

    existing = await fetch_one(
        "SELECT clerk_org_id FROM organizations WHERE name = $1",
        org_name,
    )
    if existing:
        await fetch_one(
            "UPDATE organizations SET github_org = $1 WHERE clerk_org_id = $2",
            github_org,
            existing["clerk_org_id"],
        )
        return existing["clerk_org_id"]

    row = await fetch_one(
        "INSERT INTO organizations (name, github_org, clerk_org_id) "
        "VALUES ($1, $2, $3) RETURNING clerk_org_id",
        org_name,
        github_org,
        f"org_github_{org_name}",
    )
    logger.info("org_created", name=org_name, github_org=github_org, clerk_org_id=row["clerk_org_id"])
    return row["clerk_org_id"]


async def get_org_by_github(github_org: str) -> dict | None:
    """Find organization by GitHub org name."""
    row = await fetch_one(
        "SELECT clerk_org_id as id, name, github_org, created_at FROM organizations WHERE github_org = $1",
        github_org,
    )
    return dict(row) if row else None


async def store_github_installation(
    org_id: str,
    installation_id: int,
    github_org: str,
    repositories: list[dict] | None = None,
) -> str:
    """Store or update a GitHub App installation."""
    import json

    existing = await fetch_one(
        "SELECT id::text FROM github_installations WHERE installation_id = $1",
        installation_id,
    )

    if existing:
        await fetch_one(
            """UPDATE github_installations
               SET repositories = $1, updated_at = now()
               WHERE installation_id = $2""",
            json.dumps(repositories or []),
            installation_id,
        )
        return existing["id"]

    row = await fetch_one(
        """INSERT INTO github_installations (org_id, installation_id, github_org, repositories)
           VALUES ($1, $2, $3, $4) RETURNING id::text""",
        org_id,
        installation_id,
        github_org,
        json.dumps(repositories or []),
    )
    logger.info(
        "github_installation_stored",
        org_id=org_id,
        installation_id=installation_id,
        github_org=github_org,
    )
    return row["id"]


async def remove_github_installation(installation_id: int) -> None:
    """Delete a GitHub App installation record."""
    from src.database import execute

    await execute(
        "DELETE FROM github_installations WHERE installation_id = $1",
        installation_id,
    )
    logger.info("github_installation_removed", installation_id=installation_id)


async def get_or_create_org_by_clerk(clerk_org_id: str, name: str) -> str:
    """Get or create an organization from a Clerk webhook. Returns clerk_org_id."""
    existing = await fetch_one(
        "SELECT clerk_org_id FROM organizations WHERE clerk_org_id = $1",
        clerk_org_id,
    )
    if existing:
        return existing["clerk_org_id"]

    existing = await fetch_one(
        "SELECT clerk_org_id FROM organizations WHERE name = $1",
        name,
    )
    if existing:
        await fetch_one(
            "UPDATE organizations SET clerk_org_id = $1 WHERE clerk_org_id = $2",
            clerk_org_id,
            existing["clerk_org_id"],
        )
        return clerk_org_id

    row = await fetch_one(
        "INSERT INTO organizations (name, clerk_org_id) VALUES ($1, $2) RETURNING clerk_org_id",
        name,
        clerk_org_id,
    )
    logger.info("org_created_from_clerk", name=name, clerk_org_id=clerk_org_id)
    return row["clerk_org_id"]


async def list_github_installations() -> list[dict]:
    """List all GitHub App installations with org names."""
    import json
    from src.database import fetch_all

    rows = await fetch_all(
        """SELECT gi.id::text, gi.installation_id, gi.github_org, gi.repositories,
                  gi.created_at, gi.updated_at, o.name as org_name
           FROM github_installations gi
           JOIN organizations o ON o.clerk_org_id = gi.org_id
           ORDER BY gi.created_at DESC"""
    )
    result = []
    for row in rows:
        d = dict(row)
        if isinstance(d.get("repositories"), str):
            d["repositories"] = json.loads(d["repositories"])
        result.append(d)
    return result


async def store_github_workflow(
    org_id: str,
    workflow_id: str,
    installation_id: int,
    owner: str,
    repo: str,
    issue_number: int,
) -> str:
    """Store a GitHub workflow for tracking."""
    row = await fetch_one(
        """INSERT INTO github_workflows
           (org_id, workflow_id, installation_id, owner, repo, issue_number)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text""",
        org_id,
        workflow_id,
        installation_id,
        owner,
        repo,
        issue_number,
    )
    logger.info(
        "github_workflow_stored",
        org_id=org_id,
        workflow_id=workflow_id,
        owner=owner,
        repo=repo,
        issue=issue_number,
    )
    return row["id"]


async def get_github_workflow_by_issue(owner: str, repo: str, issue_number: int) -> dict | None:
    """Get workflow by GitHub issue identifiers."""
    row = await fetch_one(
        """SELECT id::text, workflow_id, installation_id, owner, repo, issue_number, status
           FROM github_workflows
           WHERE owner = $1 AND repo = $2 AND issue_number = $3
           ORDER BY created_at DESC LIMIT 1""",
        owner,
        repo,
        issue_number,
    )
    return dict(row) if row else None


async def update_github_workflow_status(workflow_id: str, status: str) -> None:
    """Update workflow status."""
    from src.database import execute

    await execute(
        """UPDATE github_workflows
           SET status = $1,
               completed_at = CASE
                   WHEN $1 IN ('completed', 'failed') THEN now()
                   ELSE completed_at
               END
           WHERE workflow_id = $2""",
        status,
        workflow_id,
    )
