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
