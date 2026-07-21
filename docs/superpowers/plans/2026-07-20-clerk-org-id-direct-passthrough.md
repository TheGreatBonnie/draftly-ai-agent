# Clerk org_id Direct Pass-Through — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all UUID conversion layers between Clerk's `org_id` (`org_xxxxx`) and the database, so JWT values pass directly to SQL queries.

**Architecture:** The new schema (`schema.sql`) already has child tables FK-referencing `organizations(clerk_org_id)` (STRING). Two tables are missing (`clerk_users`, `user_organizations`). All `::uuid` casts on org_id values must be removed. The `get_org_by_clerk_id()` lookup becomes unnecessary. The sync script is obsolete.

**Tech Stack:** Python/FastAPI, CockroachDB, psycopg, LangGraph

---

## File Map

| File | Change |
|------|--------|
| `infrastructure/cockroachdb/schema.sql` | Add `clerk_users` + `user_organizations` tables |
| `src/memory/organizations.py` | Remove `::uuid` casts, simplify `get_or_create_org_by_clerk` return |
| `src/memory/users.py` | Remove subqueries in `add_user_to_org`/`remove_user_from_org`, delete `get_org_by_clerk_id` |
| `src/api/routes/clerk.py` | Remove `get_org_by_clerk_id` import, use `clerk_org_id` directly for delete/update |
| `src/memory/organizations.py` | Fix `list_github_installations` JOIN |
| `scripts/sync_clerk_org.py` | Delete (obsolete) |

---

## Task 1: Add missing tables to schema.sql

**Files:**
- Modify: `infrastructure/cockroachdb/schema.sql`

- [ ] **Step 1: Add `clerk_users` table definition**

Append after the `github_workflows` section (after line 195):

```sql
-- 12. Clerk Users
CREATE TABLE IF NOT EXISTS clerk_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id STRING NOT NULL UNIQUE,
    email STRING NOT NULL DEFAULT '',
    name STRING NOT NULL DEFAULT 'Unknown',
    avatar_url STRING NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now() ON UPDATE now()
);

-- 13. User-Organization memberships
CREATE TABLE IF NOT EXISTS user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES clerk_users(id) ON DELETE CASCADE,
    org_id STRING NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
    role STRING NOT NULL DEFAULT 'org:member',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_user_org_user ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_org_org ON user_organizations(org_id);
```

Note: `user_organizations.org_id` is `STRING` (not UUID) and FK-references `organizations(clerk_org_id)`.

- [ ] **Step 2: Run schema against database**

```bash
psql "postgresql://bonnie:zOTH6O1DZkroKlDAZ-Xwnw@draftly-29343.j77.aws-eu-west-2.cockroachlabs.cloud:26257/draftly-ai?sslmode=verify-full" -f infrastructure/cockroachdb/schema.sql
```

Expected: `CREATE TABLE` x2, `CREATE INDEX` x2. No errors.

- [ ] **Step 3: Verify tables exist**

```bash
psql "postgresql://bonnie:zOTH6O1DZkroKlDAZ-Xwnw@draftly-29343.j77.aws-eu-west-2.cockroachlabs.cloud:26257/draftly-ai?sslmode=verify-full" -c "\dt"
```

Expected: 13 tables (11 original + `clerk_users` + `user_organizations`).

- [ ] **Step 4: Commit**

```bash
git add infrastructure/cockroachdb/schema.sql
git commit -m "schema: add clerk_users and user_organizations tables"
```

---

## Task 2: Remove `::uuid` casts in organizations.py

**Files:**
- Modify: `src/memory/organizations.py`

The `id` column is still a UUID PK. These `::uuid` casts are on `organizations.id` (UUID), not on `org_id` (STRING). They remain correct — BUT the functions return `existing["id"]` which is a UUID, and callers treat it as an org identifier. After this migration, callers should receive `clerk_org_id` instead.

- [ ] **Step 1: Change `get_or_create_org` to return `clerk_org_id`**

Replace lines 27-60:

```python
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
```

- [ ] **Step 2: Change `get_or_create_default_org` to return `clerk_org_id`**

Replace lines 10-24:

```python
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
```

- [ ] **Step 3: Change `get_org_by_github` to return `clerk_org_id` as `id`**

Replace lines 63-69:

```python
async def get_org_by_github(github_org: str) -> dict | None:
    """Find organization by GitHub org name."""
    row = await fetch_one(
        "SELECT clerk_org_id as id, name, github_org, created_at FROM organizations WHERE github_org = $1",
        github_org,
    )
    return dict(row) if row else None
```

- [ ] **Step 4: Change `get_or_create_org_by_clerk` to return `clerk_org_id`**

Replace lines 124-151:

```python
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
```

- [ ] **Step 5: Fix `list_github_installations` JOIN**

Replace line 163:

```python
# Before:
JOIN organizations o ON o.id = gi.org_id::uuid

# After:
JOIN organizations o ON o.clerk_org_id = gi.org_id
```

- [ ] **Step 6: Commit**

```bash
git add src/memory/organizations.py
git commit -m "refactor: organizations return clerk_org_id, remove ::uuid casts"
```

---

## Task 3: Simplify users.py — remove subqueries and `get_org_by_clerk_id`

**Files:**
- Modify: `src/memory/users.py`

- [ ] **Step 1: Simplify `add_user_to_org`**

Replace lines 43-56:

```python
async def add_user_to_org(clerk_user_id: str, clerk_org_id: str, role: str = "org:member") -> str:
    """Link a user to an organization with a role."""
    row = await fetch_one(
        "INSERT INTO user_organizations (user_id, org_id, role) VALUES ("
        "  (SELECT id FROM clerk_users WHERE clerk_user_id = $1),"
        "  $2,"
        "  $3"
        ") ON CONFLICT (user_id, org_id) DO UPDATE SET role = $3 "
        "RETURNING id::text",
        clerk_user_id, clerk_org_id, role,
    )
    logger.info("user_added_to_org", user=clerk_user_id, org=clerk_org_id, role=role)
    return row["id"]
```

- [ ] **Step 2: Simplify `remove_user_from_org`**

Replace lines 59-67:

```python
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

- [ ] **Step 3: Delete `get_org_by_clerk_id` function**

Remove lines 70-76 entirely:

```python
# DELETE THIS FUNCTION:
async def get_org_by_clerk_id(clerk_org_id: str) -> dict | None:
    ...
```

- [ ] **Step 4: Commit**

```bash
git add src/memory/users.py
git commit -m "refactor: simplify users.py, remove get_org_by_clerk_id"
```

---

## Task 4: Fix clerk.py webhook handler

**Files:**
- Modify: `src/api/routes/clerk.py`

- [ ] **Step 1: Remove `get_org_by_clerk_id` import**

Remove line 17:

```python
# Before:
from src.memory.users import (
    add_user_to_org,
    create_clerk_user,
    delete_clerk_user,
    get_org_by_clerk_id,  # DELETE THIS
    remove_user_from_org,
)

# After:
from src.memory.users import (
    add_user_to_org,
    create_clerk_user,
    delete_clerk_user,
    remove_user_from_org,
)
```

- [ ] **Step 2: Fix `organization.deleted` handler**

Replace lines 97-103:

```python
elif event_type == "organization.deleted":
    from src.database import execute as db_execute

    await db_execute("DELETE FROM organizations WHERE clerk_org_id = $1", data["id"])
    logger.info("org_deleted_from_clerk", clerk_org_id=data["id"])
```

- [ ] **Step 3: Fix `organization.updated` handler**

Replace lines 105-114:

```python
elif event_type == "organization.updated":
    from src.database import execute as db_execute

    await db_execute(
        "UPDATE organizations SET clerk_org_name = $1 WHERE clerk_org_id = $2",
        data.get("name", ""),
        data["id"],
    )
```

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/clerk.py
git commit -m "fix: clerk webhook uses clerk_org_id directly, remove get_org_by_clerk_id"
```

---

## Task 5: Delete obsolete sync script

**Files:**
- Delete: `scripts/sync_clerk_org.py`

- [ ] **Step 1: Delete the file**

```bash
rm scripts/sync_clerk_org.py
```

- [ ] **Step 2: Commit**

```bash
git add -A scripts/sync_clerk_org.py
git commit -m "chore: delete obsolete sync_clerk_org.py"
```

---

## Task 6: Verification

- [ ] **Step 1: Run grep to confirm no remaining `::uuid` casts on org_id**

```bash
rg "::uuid" src/ --include "*.py" | grep -i org
```

Expected: Only `organizations.py` line 47 (`WHERE id = $2::uuid` for `github_org` update on UUID PK) — this is correct.

- [ ] **Step 2: Run grep to confirm no remaining `get_org_by_clerk_id` references**

```bash
rg "get_org_by_clerk_id" src/
```

Expected: No results.

- [ ] **Step 3: Run any existing tests**

```bash
cd /Applications/Projects/hackathon/draftly && python -m pytest tests/ -v --tb=short 2>&1 | head -60
```

Expected: Tests pass (or fail only on missing DB connection, not syntax errors).

---

## Summary

After these 6 tasks:
- JWT `org_id: "org_xxxxx"` passes directly to all SQL queries
- No UUID conversion layer anywhere
- `clerk_users` and `user_organizations` tables exist on the new cluster
- `sync_clerk_org.py` is gone
- All org functions return `clerk_org_id` (STRING) instead of UUID
