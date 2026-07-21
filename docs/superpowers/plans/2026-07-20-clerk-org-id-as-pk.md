# Clerk org_id as Primary Key — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the UUID-to-Clerk-ID mapping layer by making Clerk's `org_xxxxx` format the primary key for `organizations`, so JWT auth works without translation.

**Architecture:** The Clerk JWT `org_id` (format `org_xxxxx`) is passed directly into every SQL query. Currently `organizations.id` is a UUID, causing crashes at every API route. This migration changes `organizations.id` to STRING, removes the `clerk_org_id` column, and updates all child table FK columns to match. Two prerequisite bugs (webhook signature verification, JWT template case) are fixed first.

**Tech Stack:** CockroachDB, asyncpg, FastAPI, Clerk webhooks (Svix), Python 3.11

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `infrastructure/cockroachdb/migrations/007_use_clerk_org_id_as_pk.sql` | Create | Database migration: alter PK type, drop clerk_org_id, update FKs |
| `src/api/routes/clerk.py` | Modify | Fix webhook signature verification, remove `::uuid` casts |
| `frontend/src/components/AuthTokenSetter.tsx` | Modify | Fix JWT template case mismatch |
| `src/memory/organizations.py` | Modify | Remove `clerk_org_id` references, simplify all functions |
| `src/memory/users.py` | Modify | Remove subqueries through `clerk_org_id`, use org_id directly |
| `src/api/routes/github.py` | Modify | Generate `org_github_*` IDs for GitHub-created orgs |
| `src/api/routes/clerk.py` | Modify | Remove `::uuid` casts in delete/update queries |
| `scripts/seed_demo_data.py` | Modify | Generate `org_github_*` IDs instead of UUIDs |
| `scripts/sync_clerk_org.py` | Delete | No longer needed — purpose was bridging Clerk IDs to UUIDs |
| `infrastructure/cockroachdb/schema.sql` | Modify | Update canonical schema to reflect new PK type |
| `context/SCHEMA.md` | Modify | Update documentation |

---

## Task 1: Fix Webhook Signature Verification (Prerequisite)

The webhook returns 401 because the `whsec_` prefix is not stripped from the signing secret before HMAC verification.

**Files:**
- Modify: `src/api/routes/clerk.py:39-41`

- [ ] **Step 1: Strip `whsec_` prefix and base64-decode the signing secret**

Replace lines 39-41 in `verify_svix_signature`:

```python
# Before (broken)
secret = settings.clerk_signing_secret.get_secret_value()
to_sign = f"{svix_id}.{svix_timestamp}.{payload.decode()}"
expected = hmac.new(secret.encode(), to_sign.encode(), hashlib.sha256).digest()

# After (fixed)
raw_secret = settings.clerk_signing_secret.get_secret_value()
signing_key = base64.b64decode(raw_secret.removeprefix("whsec_"))
to_sign = f"{svix_id}.{svix_timestamp}.{payload.decode()}"
expected = hmac.new(signing_key, to_sign.encode(), hashlib.sha256).digest()
```

- [ ] **Step 2: Verify the server starts without errors**

Run: `uv run uvicorn src.api.app:app --reload`
Expected: Server starts, no import errors

- [ ] **Step 3: Commit**

```bash
git add src/api/routes/clerk.py
git commit -m "fix: strip whsec_ prefix from Clerk webhook signing secret"
```

---

## Task 2: Fix JWT Template Case Mismatch (Prerequisite)

Frontend requests `template: 'draftly'` but the Clerk template is named `Draftly`.

**Files:**
- Modify: `frontend/src/components/AuthTokenSetter.tsx:14`

- [ ] **Step 1: Fix the template name to match Clerk Dashboard**

```tsx
// Before (broken)
const promise = getToken({ skipCache: true, template: 'draftly' }).then((token) => {

// After (fixed)
const promise = getToken({ skipCache: true, template: 'Draftly' }).then((token) => {
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AuthTokenSetter.tsx
git commit -m "fix: match JWT template case to Clerk Dashboard (Draftly)"
```

---

## Task 3: Create Database Migration

**Files:**
- Create: `infrastructure/cockroachdb/migrations/007_use_clerk_org_id_as_pk.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Migration: Use Clerk org_id as primary key for organizations
-- Date: 2026-07-20
--
-- This migration:
-- 1. Drops all FK constraints referencing organizations(id)
-- 2. Changes organizations.id from UUID to STRING
-- 3. Removes clerk_org_id column (no longer needed)
-- 4. Changes all child table org_id columns from UUID to STRING
-- 5. Re-adds FK constraints and indexes
-- 6. Backfills existing rows with synthetic Clerk-format IDs

BEGIN;

-- ── Step 1: Drop all FK constraints ──

ALTER TABLE support_threads DROP CONSTRAINT IF EXISTS fk_support_threads_org;
ALTER TABLE documentation DROP CONSTRAINT IF EXISTS fk_documentation_org;
ALTER TABLE embeddings DROP CONSTRAINT IF EXISTS fk_embeddings_org;
ALTER TABLE agent_workflows DROP CONSTRAINT IF EXISTS fk_agent_workflows_org;
ALTER TABLE agent_memory DROP CONSTRAINT IF EXISTS fk_agent_memory_org;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS fk_audit_logs_org;
ALTER TABLE reviewers DROP CONSTRAINT IF EXISTS fk_reviewers_org;
ALTER TABLE github_installations DROP CONSTRAINT IF EXISTS fk_github_installations_org;
ALTER TABLE github_workflows DROP CONSTRAINT IF EXISTS fk_github_workflows_org;
ALTER TABLE user_organizations DROP CONSTRAINT IF EXISTS fk_user_organizations_org;

-- ── Step 2: Drop existing indexes on org_id columns ──

DROP INDEX IF EXISTS idx_support_threads_org;
DROP INDEX IF EXISTS idx_doc_org;
DROP INDEX IF EXISTS idx_embeddings_org;
DROP INDEX IF EXISTS idx_workflow_org;
DROP INDEX IF EXISTS idx_memory_org;
DROP INDEX IF EXISTS idx_audit_org;
DROP INDEX IF EXISTS idx_reviewers_org;
DROP INDEX IF EXISTS idx_reviewers_active;
DROP INDEX IF EXISTS idx_installations_org;
DROP INDEX IF EXISTS idx_installations_github_org;
DROP INDEX IF EXISTS idx_user_org_org;
DROP INDEX IF EXISTS idx_organizations_clerk_org_id;

-- Drop unique constraints
ALTER TABLE support_threads DROP CONSTRAINT IF EXISTS support_threads_org_id_channel_id_thread_id_key;
ALTER TABLE agent_memory DROP CONSTRAINT IF EXISTS agent_memory_org_id_key;
ALTER TABLE user_organizations DROP CONSTRAINT IF EXISTS user_organizations_user_id_org_id_key;

-- Drop partial unique indexes on reviewers
DROP INDEX IF EXISTS idx_reviewers_email_org;
DROP INDEX IF EXISTS idx_reviewers_slack_org;
DROP INDEX IF EXISTS idx_reviewers_discord_org;

-- ── Step 3: Alter organizations table ──

-- Change id type from UUID to STRING
ALTER TABLE organizations ALTER COLUMN id SET DATA TYPE STRING;
ALTER TABLE organizations ALTER COLUMN id DROP DEFAULT;

-- Remove clerk_org_id column
ALTER TABLE organizations DROP COLUMN IF EXISTS clerk_org_id;

-- ── Step 4: Backfill existing data ──
-- Map UUID-based IDs to synthetic Clerk-format IDs

UPDATE organizations SET id = 'org_default' WHERE name = 'default';
UPDATE organizations SET id = 'org_github_' || name WHERE name != 'default' AND id != 'org_default';

-- ── Step 5: Alter all child table org_id columns ──

ALTER TABLE support_threads ALTER COLUMN org_id SET DATA TYPE STRING;
ALTER TABLE documentation ALTER COLUMN org_id SET DATA TYPE STRING;
ALTER TABLE embeddings ALTER COLUMN org_id SET DATA TYPE STRING;
ALTER TABLE agent_workflows ALTER COLUMN org_id SET DATA TYPE STRING;
ALTER TABLE agent_memory ALTER COLUMN org_id SET DATA TYPE STRING;
ALTER TABLE audit_logs ALTER COLUMN org_id SET DATA TYPE STRING;
ALTER TABLE reviewers ALTER COLUMN org_id SET DATA TYPE STRING;
ALTER TABLE github_installations ALTER COLUMN org_id SET DATA TYPE STRING;
ALTER TABLE github_workflows ALTER COLUMN org_id SET DATA TYPE STRING;
ALTER TABLE user_organizations ALTER COLUMN org_id SET DATA TYPE STRING;

-- ── Step 6: Re-add FK constraints ──

ALTER TABLE support_threads ADD CONSTRAINT fk_support_threads_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE documentation ADD CONSTRAINT fk_documentation_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE embeddings ADD CONSTRAINT fk_embeddings_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE agent_workflows ADD CONSTRAINT fk_agent_workflows_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE agent_memory ADD CONSTRAINT fk_agent_memory_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE reviewers ADD CONSTRAINT fk_reviewers_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE github_installations ADD CONSTRAINT fk_github_installations_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE github_workflows ADD CONSTRAINT fk_github_workflows_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE user_organizations ADD CONSTRAINT fk_user_organizations_org
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ── Step 7: Re-create indexes ──

CREATE INDEX idx_support_threads_org ON support_threads(org_id);
CREATE INDEX idx_doc_org ON documentation(org_id);
CREATE INDEX idx_embeddings_org ON embeddings(org_id);
CREATE INDEX idx_workflow_org ON agent_workflows(org_id);
CREATE INDEX idx_memory_org ON agent_memory(org_id);
CREATE INDEX idx_audit_org ON audit_logs(org_id);
CREATE INDEX idx_reviewers_org ON reviewers(org_id);
CREATE INDEX idx_reviewers_active ON reviewers(is_active);
CREATE INDEX idx_installations_org ON github_installations(org_id);
CREATE INDEX idx_installations_github_org ON github_installations(github_org);
CREATE INDEX idx_user_org_org ON user_organizations(org_id);

-- Recreate unique constraints
CREATE UNIQUE INDEX idx_support_threads_org_channel_thread
    ON support_threads(org_id, channel_id, thread_id);
CREATE UNIQUE INDEX idx_agent_memory_org_key
    ON agent_memory(org_id, key);
CREATE UNIQUE INDEX idx_user_org_unique
    ON user_organizations(user_id, org_id);

-- Recreate partial unique indexes on reviewers
CREATE UNIQUE INDEX idx_reviewers_email_org ON reviewers(org_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_reviewers_slack_org ON reviewers(org_id, slack_user_id) WHERE slack_user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_reviewers_discord_org ON reviewers(org_id, discord_user_id) WHERE discord_user_id IS NOT NULL;

COMMIT;
```

- [ ] **Step 2: Verify migration syntax is valid**

Run: `psql "$COCKROACHDB_URL" -f infrastructure/cockroachdb/migrations/007_use_clerk_org_id_as_pk.sql`
Expected: `BEGIN` / `COMMIT` messages, no errors

- [ ] **Step 3: Verify data backfill**

Run: `psql "$COCKROACHDB_URL" -c "SELECT id, name FROM organizations;"`
Expected output:
```
       id         |      name
------------------+----------------
 org_default      | default
 org_github_...   | TheGreatBonnie
 org_github_...   | Acme Corp
```
All IDs should be STRING format, no UUIDs.

- [ ] **Step 4: Verify FK constraints exist**

Run: `psql "$COCKROACHDB_URL" -c "SELECT tc.table_name, tc.constraint_name FROM information_schema.table_constraints tc WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name;"`
Expected: 10 FK constraints listed (one per child table)

- [ ] **Step 5: Commit**

```bash
git add infrastructure/cockroachdb/migrations/007_use_clerk_org_id_as_pk.sql
git commit -m "feat: migration 007 — use Clerk org_id as organizations PK"
```

---

## Task 4: Update `src/memory/organizations.py`

**Files:**
- Modify: `src/memory/organizations.py` (entire file)

- [ ] **Step 1: Rewrite the file**

```python
from __future__ import annotations

import structlog

from src.database import fetch_all, fetch_one

logger = structlog.get_logger()


async def get_or_create_default_org(name: str = "default") -> str:
    """Get or create an org by name. Used by API routes and CLI."""
    existing = await fetch_one(
        "SELECT id FROM organizations WHERE name = $1",
        name,
    )
    if existing:
        return existing["id"]

    org_id = f"org_{name}"
    row = await fetch_one(
        "INSERT INTO organizations (id, name) VALUES ($1, $2) RETURNING id",
        org_id, name,
    )
    logger.info("org_created", name=name, id=row["id"])
    return row["id"]


async def get_or_create_org(github_org: str, name: str | None = None) -> str:
    """Get or create organization for GitHub repo."""
    org_name = name or github_org

    existing = await fetch_one(
        "SELECT id FROM organizations WHERE github_org = $1",
        github_org,
    )
    if existing:
        return existing["id"]

    existing = await fetch_one(
        "SELECT id FROM organizations WHERE name = $1",
        org_name,
    )
    if existing:
        await fetch_one(
            "UPDATE organizations SET github_org = $1 WHERE id = $2",
            github_org, existing["id"],
        )
        return existing["id"]

    org_id = f"org_github_{github_org}"
    row = await fetch_one(
        "INSERT INTO organizations (id, name, github_org) VALUES ($1, $2, $3) RETURNING id",
        org_id, org_name, github_org,
    )
    logger.info("org_created", name=org_name, github_org=github_org, id=row["id"])
    return row["id"]


async def get_org_by_github(github_org: str) -> dict | None:
    """Find organization by GitHub org name."""
    row = await fetch_one(
        "SELECT id, name, github_org, created_at FROM organizations WHERE github_org = $1",
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
        "SELECT id FROM github_installations WHERE installation_id = $1",
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
           VALUES ($1, $2, $3, $4) RETURNING id""",
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
    """Get or create an organization from a Clerk organization webhook.
    The clerk_org_id IS the primary key — no mapping needed."""
    row = await fetch_one(
        "INSERT INTO organizations (id, name) VALUES ($1, $2) "
        "ON CONFLICT (id) DO UPDATE SET name = $2 "
        "RETURNING id",
        clerk_org_id, name,
    )
    logger.info("org_upserted_from_clerk", name=name, clerk_org_id=clerk_org_id, id=row["id"])
    return row["id"]


async def list_github_installations() -> list[dict]:
    """List all GitHub App installations with org names."""
    import json

    rows = await fetch_all(
        """SELECT gi.id, gi.installation_id, gi.github_org, gi.repositories,
                  gi.created_at, gi.updated_at, o.name as org_name
           FROM github_installations gi
           JOIN organizations o ON o.id = gi.org_id
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
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id""",
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
        """SELECT id, workflow_id, installation_id, owner, repo, issue_number, status
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
```

- [ ] **Step 2: Verify no import errors**

Run: `uv run python -c "from src.memory.organizations import get_or_create_org, get_or_create_org_by_clerk; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/memory/organizations.py
git commit -m "refactor: use Clerk org_id as PK, remove clerk_org_id column references"
```

---

## Task 5: Update `src/memory/users.py`

**Files:**
- Modify: `src/memory/users.py` (entire file)

- [ ] **Step 1: Rewrite the file**

```python
from __future__ import annotations

import structlog

from src.database import execute, fetch_all, fetch_one

logger = structlog.get_logger()


async def create_clerk_user(clerk_user_id: str, email: str, name: str, avatar_url: str = "") -> str:
    """Create a new user record from Clerk webhook data."""
    existing = await fetch_one(
        "SELECT id FROM clerk_users WHERE clerk_user_id = $1",
        clerk_user_id,
    )
    if existing:
        await execute(
            "UPDATE clerk_users SET email = $1, name = $2, avatar_url = $3, updated_at = now() "
            "WHERE clerk_user_id = $4",
            email, name, avatar_url, clerk_user_id,
        )
        return existing["id"]

    row = await fetch_one(
        "INSERT INTO clerk_users (clerk_user_id, email, name, avatar_url) "
        "VALUES ($1, $2, $3, $4) RETURNING id",
        clerk_user_id, email, name, avatar_url,
    )
    logger.info("clerk_user_created", user_id=clerk_user_id)
    return row["id"]


async def delete_clerk_user(clerk_user_id: str) -> None:
    """Remove a user from the local DB (soft-delete or remove memberships first)."""
    await execute(
        "DELETE FROM user_organizations WHERE user_id = (SELECT id FROM clerk_users WHERE clerk_user_id = $1)",
        clerk_user_id,
    )
    await execute("DELETE FROM clerk_users WHERE clerk_user_id = $1", clerk_user_id)
    logger.info("clerk_user_deleted", user_id=clerk_user_id)


async def add_user_to_org(clerk_user_id: str, clerk_org_id: str, role: str = "org:member") -> str:
    """Link a user to an organization with a role.
    clerk_org_id is now the primary key of organizations — no subquery needed."""
    row = await fetch_one(
        "INSERT INTO user_organizations (user_id, org_id, role) "
        "VALUES ("
        "  (SELECT id FROM clerk_users WHERE clerk_user_id = $1),"
        "  $2,"
        "  $3"
        ") ON CONFLICT (user_id, org_id) DO UPDATE SET role = $3 "
        "RETURNING id",
        clerk_user_id, clerk_org_id, role,
    )
    logger.info("user_added_to_org", user=clerk_user_id, org=clerk_org_id, role=role)
    return row["id"]


async def remove_user_from_org(clerk_user_id: str, clerk_org_id: str) -> None:
    """Remove a user from an organization."""
    await execute(
        "DELETE FROM user_organizations "
        "WHERE user_id = (SELECT id FROM clerk_users WHERE clerk_user_id = $1) "
        "AND org_id = $2",
        clerk_user_id, clerk_org_id,
    )
    logger.info("user_removed_from_org", user=clerk_user_id, org=clerk_org_id)
```

- [ ] **Step 2: Verify no import errors**

Run: `uv run python -c "from src.memory.users import add_user_to_org, remove_user_from_org; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/memory/users.py
git commit -m "refactor: remove clerk_org_id subqueries from users.py"
```

---

## Task 6: Update `src/api/routes/clerk.py`

**Files:**
- Modify: `src/api/routes/clerk.py`

- [ ] **Step 1: Remove `::uuid` casts and `get_org_by_clerk_id` import**

Replace the import block (lines 12-19):

```python
# Before
from src.memory.organizations import get_or_create_org_by_clerk
from src.memory.users import (
    add_user_to_org,
    create_clerk_user,
    delete_clerk_user,
    get_org_by_clerk_id,
    remove_user_from_org,
)

# After
from src.memory.organizations import get_or_create_org_by_clerk
from src.memory.users import (
    add_user_to_org,
    create_clerk_user,
    delete_clerk_user,
    remove_user_from_org,
)
```

Replace the `organization.deleted` handler (lines 96-102):

```python
# Before
elif event_type == "organization.deleted":
    org = await get_org_by_clerk_id(data["id"])
    if org:
        from src.database import execute as db_execute

        await db_execute("DELETE FROM organizations WHERE id = $1::uuid", org["id"])
        logger.info("org_deleted_from_clerk", org_id=org["id"])

# After
elif event_type == "organization.deleted":
    from src.database import execute as db_execute

    await db_execute("DELETE FROM organizations WHERE id = $1", data["id"])
    logger.info("org_deleted_from_clerk", org_id=data["id"])
```

Replace the `organization.updated` handler (lines 104-113):

```python
# Before
elif event_type == "organization.updated":
    org = await get_org_by_clerk_id(data["id"])
    if org:
        from src.database import execute as db_execute

        await db_execute(
            "UPDATE organizations SET name = $1 WHERE id = $2::uuid",
            data.get("name", org["name"]),
            org["id"],
        )

# After
elif event_type == "organization.updated":
    from src.database import execute as db_execute

    await db_execute(
        "UPDATE organizations SET name = $1 WHERE id = $2",
        data.get("name", "Unnamed Organization"),
        data["id"],
    )
```

- [ ] **Step 2: Verify no import errors**

Run: `uv run python -c "from src.api.routes.clerk import router; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/api/routes/clerk.py
git commit -m "refactor: remove ::uuid casts and get_org_by_clerk_id from clerk webhook"
```

---

## Task 7: Update `src/api/routes/github.py`

No changes needed — `get_or_create_org()` already returns a string, and `store_github_installation()` accepts it. The org_id format changes from UUID to `org_github_*` but the downstream code treats it as an opaque string.

- [ ] **Step 1: Verify no changes needed**

Run: `uv run python -c "from src.api.routes.github import router; print('OK')"`
Expected: `OK`

- [ ] **Step 2: Commit (no-op, verification only)**

```bash
git commit --allow-empty -m "chore: verify github.py works with new org_id format"
```

---

## Task 8: Update `scripts/seed_demo_data.py`

**Files:**
- Modify: `scripts/seed_demo_data.py`

- [ ] **Step 1: Update `_get_or_create_org` to generate Clerk-format IDs**

Replace lines 75-90:

```python
# Before
async def _get_or_create_org(github_org: str) -> str:
    """Get existing org by github_org, or create one."""
    row = await fetch_one(
        "SELECT id::text FROM organizations WHERE github_org = $1",
        github_org,
    )
    if row:
        return row["id"]

    row = await fetch_one(
        "INSERT INTO organizations (name, github_org) VALUES ($1, $2) RETURNING id::text",
        github_org,
        github_org,
    )
    print(f"Created org: {github_org} ({row['id']})")
    return row["id"]

# After
async def _get_or_create_org(github_org: str) -> str:
    """Get existing org by github_org, or create one."""
    row = await fetch_one(
        "SELECT id FROM organizations WHERE github_org = $1",
        github_org,
    )
    if row:
        return row["id"]

    org_id = f"org_github_{github_org}"
    row = await fetch_one(
        "INSERT INTO organizations (id, name, github_org) VALUES ($1, $2, $3) RETURNING id",
        org_id, github_org, github_org,
    )
    print(f"Created org: {github_org} ({row['id']})")
    return row["id"]
```

- [ ] **Step 2: Remove `::text` cast from reviewer query (line 100)**

```python
# Before
existing_reviewer = await fetch_one(
    "SELECT id::text FROM reviewers WHERE org_id = $1 AND is_active = true",
    webhook_org_id,
)

# After
existing_reviewer = await fetch_one(
    "SELECT id FROM reviewers WHERE org_id = $1 AND is_active = true",
    webhook_org_id,
)
```

- [ ] **Step 3: Verify no import errors**

Run: `uv run python -c "from scripts.seed_demo_data import seed; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add scripts/seed_demo_data.py
git commit -m "refactor: seed script generates Clerk-format org IDs"
```

---

## Task 9: Delete `scripts/sync_clerk_org.py`

This script bridged Clerk IDs to UUID PKs. With Clerk IDs as PKs, it's obsolete.

**Files:**
- Delete: `scripts/sync_clerk_org.py`

- [ ] **Step 1: Delete the file**

```bash
rm scripts/sync_clerk_org.py
```

- [ ] **Step 2: Commit**

```bash
git add -A scripts/sync_clerk_org.py
git commit -m "chore: delete sync_clerk_org.py (obsolete with Clerk ID as PK)"
```

---

## Task 10: Update Canonical Schema

**Files:**
- Modify: `infrastructure/cockroachdb/schema.sql`

- [ ] **Step 1: Update the `organizations` table definition (lines 5-12)**

```sql
-- Before
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name STRING NOT NULL,
    slack_workspace_id STRING,
    discord_guild_id STRING,
    github_org STRING,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- After
CREATE TABLE IF NOT EXISTS organizations (
    id STRING PRIMARY KEY,
    name STRING NOT NULL,
    slack_workspace_id STRING,
    discord_guild_id STRING,
    github_org STRING,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 2: Update all child table `org_id` columns from UUID to STRING**

Search and replace every occurrence of `org_id UUID NOT NULL REFERENCES organizations(id)` with `org_id STRING NOT NULL REFERENCES organizations(id)` in these tables:
- `support_threads` (line 17)
- `documentation` (line 38)
- `embeddings` (line 57)
- `agent_workflows` (line 94)
- `agent_memory` (line 111)
- `audit_logs` (line 129)
- `reviewers` (line 146)
- `github_installations` (line 168)
- `github_workflows` (line 182)

- [ ] **Step 3: Update `user_organizations` org_id in migration 006**

Read `infrastructure/cockroachdb/migrations/006_add_clerk_tables.sql` and update line 23:

```sql
-- Before
org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

-- After
org_id STRING NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
```

- [ ] **Step 4: Commit**

```bash
git add infrastructure/cockroachdb/schema.sql infrastructure/cockroachdb/migrations/006_add_clerk_tables.sql
git commit -m "docs: update schema.sql and migration 006 for Clerk ID as PK"
```

---

## Task 11: Update Documentation

**Files:**
- Modify: `context/SCHEMA.md`

- [ ] **Step 1: Update the organizations table definition (lines 38-46)**

```markdown
### 1. organizations (Multi-tenant)

| Column | Type | Constraints |
|--------|------|-------------|
| id | STRING | PRIMARY KEY (Clerk org_id, e.g. `org_xxxxx`) |
| name | STRING | NOT NULL |
| slack_workspace_id | STRING | |
| discord_guild_id | STRING | |
| github_org | STRING | |
| created_at | TIMESTAMPTZ | DEFAULT now() |
```

- [ ] **Step 2: Update all child table `org_id` type from UUID to STRING**

In every table definition, change `org_id | UUID |` to `org_id | STRING |`.

- [ ] **Step 3: Add a note about ID formats**

Add after the organizations table definition:

```markdown
**ID Formats:**
- Clerk orgs: `org_xxxxx` (native Clerk ID)
- GitHub orgs: `org_github_<login>` (synthetic)
- Default/CLI: `org_default` (synthetic)
```

- [ ] **Step 4: Update migration notes (lines 186-191)**

```markdown
## Migrations

- Schema versioning tracked via `version` column in documentation
- Use `ALTER TABLE` for schema changes
- Always add indexes for new query patterns
- Test migrations on staging before production
- **Migration 007:** Changed `organizations.id` from UUID to STRING (Clerk org_id as PK)
```

- [ ] **Step 5: Commit**

```bash
git add context/SCHEMA.md
git commit -m "docs: update SCHEMA.md for Clerk ID as primary key"
```

---

## Task 12: End-to-End Verification

- [ ] **Step 1: Start the server**

Run: `uv run uvicorn src.api.app:app --reload`
Expected: Server starts without errors

- [ ] **Step 2: Verify organizations table schema**

Run: `psql "$COCKROACHDB_URL" -c "\d organizations"` (or query `information_schema.columns`)
Expected: `id` is `text` type, no `clerk_org_id` column

- [ ] **Step 3: Verify all orgs have STRING IDs**

Run: `psql "$COCKROACHDB_URL" -c "SELECT id, name FROM organizations;"`
Expected: All IDs are `org_*` format, no UUIDs

- [ ] **Step 4: Verify FK constraints are intact**

Run: `psql "$COCKROACHDB_URL" -c "SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name;"`
Expected: 10 FK constraints all referencing `organizations(id)`

- [ ] **Step 5: Verify pending reviews endpoint works**

Run: `curl -s http://localhost:8000/api/reviews/pending -H "Authorization: Bearer <valid_clerk_jwt>"`
Expected: 200 OK with `[]` or review list (not 500 UUID error)

- [ ] **Step 6: Verify GitHub installations endpoint works**

Run: `curl -s http://localhost:8000/api/github/installations -H "Authorization: Bearer <valid_clerk_jwt>"`
Expected: 200 OK with installation list

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: Clerk org_id as primary key — complete migration"
```

---

## Rollback Plan

If the migration fails or causes issues:

```sql
-- 1. Restore from backup (if taken before migration)
-- 2. Or manually reverse the type changes:
ALTER TABLE organizations ALTER COLUMN id SET DATA TYPE UUID USING id::uuid;
-- Re-add DEFAULT
ALTER TABLE organizations ALTER COLUMN id SET DEFAULT gen_random_uuid();
-- Re-add clerk_org_id column
ALTER TABLE organizations ADD COLUMN clerk_org_id STRING;
-- Revert all child table org_id columns
-- (each table: ALTER TABLE ... ALTER COLUMN org_id SET DATA TYPE UUID USING org_id::uuid)
```

**Important:** Take a backup before running the migration:
```sql
CREATE TABLE organizations_backup AS SELECT * FROM organizations;
-- For each child table, back up org_id mappings
```
