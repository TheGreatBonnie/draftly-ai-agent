# CockroachDB Vector Index Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three CockroachDB vector indexing issues: missing cluster setting, missing prefix columns, and missing `init_db.py` script referenced by CI.

**Architecture:** Add `feature.vector_index.enabled` cluster setting and prefix columns to schema.sql. Create the missing `scripts/init_db.py` that CI expects, which applies schema and sets cluster settings. No new dependencies.

**Tech Stack:** SQL, Python (asyncpg), CockroachDB

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `infrastructure/cockroachdb/schema.sql` | Modify | Add cluster setting, add prefix columns to vector index |
| `scripts/init_db.py` | Create | Database initialization script (schema + cluster settings) |

---

### Task 1: Add cluster setting and prefix columns to schema.sql

**Files:**
- Modify: `infrastructure/cockroachdb/schema.sql`

- [ ] **Step 1: Add cluster setting at the top of schema.sql**

After the comment header (line 3), before the first CREATE TABLE, add:

```sql
-- Enable vector indexes (required for CREATE VECTOR INDEX to work)
SET CLUSTER SETTING feature.vector_index.enabled = true;
```

- [ ] **Step 2: Update vector index to use prefix columns**

Replace the existing vector index (line 71):

```sql
-- Old:
CREATE VECTOR INDEX idx_embeddings_vector ON embeddings (embedding vector_cosine_ops);
```

With prefix-column version:

```sql
-- Distributed Vector Index for semantic search (org_id prefix for multi-tenant pre-filtering)
CREATE VECTOR INDEX idx_embeddings_vector ON embeddings (org_id, embedding vector_cosine_ops);
```

- [ ] **Step 3: Run linter**

Run: `uv run ruff check infrastructure/`
Expected: No errors (SQL files not checked by ruff, but verify no Python files broke)

- [ ] **Step 4: Commit**

```bash
git add infrastructure/cockroachdb/schema.sql
git commit -m "fix: add vector index cluster setting and prefix columns to schema"
```

---

### Task 2: Create scripts/init_db.py

**Files:**
- Create: `scripts/init_db.py`

- [ ] **Step 1: Create the init_db.py script**

```python
"""Initialize the Draftly database schema and cluster settings.

Usage:
    uv run python scripts/init_db.py

Requires COCKROACHDB_URL environment variable.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import asyncpg


SCHEMA_PATH = Path(__file__).parent.parent / "infrastructure" / "cockroachdb" / "schema.sql"


async def init_db() -> None:
    url = os.environ.get("COCKROACHDB_URL")
    if not url:
        print("ERROR: COCKROACHDB_URL environment variable is not set", file=sys.stderr)
        sys.exit(1)

    if not SCHEMA_PATH.exists():
        print(f"ERROR: Schema file not found at {SCHEMA_PATH}", file=sys.stderr)
        sys.exit(1)

    schema_sql = SCHEMA_PATH.read_text()

    conn = await asyncpg.connect(url)
    try:
        print("Applying schema...")
        await conn.execute(schema_sql)
        print("Schema applied successfully.")

        # Verify vector index exists
        index = await conn.fetchrow(
            "SELECT indexdef FROM pg_indexes WHERE tablename = 'embeddings' AND indexname = 'idx_embeddings_vector'"
        )
        if index:
            print(f"Vector index verified: {index['indexdef']}")
        else:
            print("WARNING: Vector index idx_embeddings_vector not found", file=sys.stderr)

        # Verify cluster setting
        setting = await conn.fetchrow(
            "SHOW CLUSTER SETTING feature.vector_index.enabled"
        )
        if setting and setting[0]:
            print(f"Cluster setting verified: feature.vector_index.enabled = {setting[0]}")
        else:
            print("WARNING: feature.vector_index.enabled is not set", file=sys.stderr)

    finally:
        await conn.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(init_db())
```

- [ ] **Step 2: Verify the script runs without errors (dry check)**

Run: `uv run python -c "from scripts import init_db"` or `uv run python scripts/init_db.py` (will fail without COCKROACHDB_URL, which is expected — just verify no import errors)
Expected: Script loads without ImportError

- [ ] **Step 3: Run linter**

Run: `uv run ruff check scripts/init_db.py`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add scripts/init_db.py
git commit -m "feat: add init_db.py script for database initialization"
```

---

### Task 3: Verify everything works together

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `uv run pytest tests/ -v --tb=short`
Expected: All tests pass (no regressions)

- [ ] **Step 2: Run linter on modified files**

Run: `uv run ruff check scripts/init_db.py infrastructure/`
Expected: No errors

- [ ] **Step 3: Verify schema.sql is valid SQL**

Run: `uv run python -c "open('infrastructure/cockroachdb/schema.sql').read()"`
Expected: No syntax error

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address lint issues from vector index fixes"
```
