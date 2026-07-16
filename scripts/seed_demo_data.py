"""Seed CockroachDB with demo data for the hackathon demo."""

import asyncio
import json
import random
from src.database import get_pool, execute, fetch_one
from src.memory.vector_store import store_embedding

DEMO_ORG = {
    "name": "Acme Corp",
    "slack_workspace_id": "T123456",
    "discord_guild_id": "789012",
    "github_org": "acme-corp",
}

SUPPORT_THREADS = [
    {"source": "slack", "title": "How to configure CockroachDB MCP with Claude Code", "question": "How do I set up CockroachDB MCP server to work with Claude Code? I keep getting connection errors."},
    {"source": "slack", "title": "CockroachDB vector search performance", "question": "Our vector searches are slow with 1M embeddings. How do we optimize the index?"},
    {"source": "discord", "title": "Migrating from PostgreSQL to CockroachDB", "question": "What's the best approach for migrating a PostgreSQL database to CockroachDB? Any gotchas?"},
    {"source": "github", "title": "CockroachDB connection pooling best practices", "question": "What connection pool settings should we use for CockroachDB in production with asyncpg?"},
    {"source": "slack", "title": "CockroachDB cloud backup configuration", "question": "How do I set up automated backups for my CockroachDB Cloud cluster?"},
    {"source": "discord", "title": "Debugging slow queries in CockroachDB", "question": "Some queries that were fast in PostgreSQL are slow in CockroachDB. How do I debug this?"},
    {"source": "slack", "title": "CockroachDB multi-region setup", "question": "How do I configure a multi-region CockroachDB cluster for low-latency reads?"},
    {"source": "github", "title": "CockroachDB schema design for time-series data", "question": "What's the recommended schema pattern for time-series data in CockroachDB?"},
]

async def seed():
    pool = await get_pool()

    # Create demo org
    org_row = await fetch_one(
        "INSERT INTO organizations (name, slack_workspace_id, discord_guild_id, github_org) "
        "VALUES ($1, $2, $3, $4) RETURNING id::text",
        DEMO_ORG["name"], DEMO_ORG["slack_workspace_id"],
        DEMO_ORG["discord_guild_id"], DEMO_ORG["github_org"],
    )
    org_id = org_row["id"]
    print(f"Created org: {org_id}")

    # Create support threads
    for thread in SUPPORT_THREADS:
        row = await fetch_one(
            "INSERT INTO support_threads (org_id, source, channel_id, thread_id, title, question_summary, status) "
            "VALUES ($1, $2, $3, $4, $5, $6, 'resolved') RETURNING id::text",
            org_id, thread["source"], f"C{random.randint(100,999)}",
            f"T{random.randint(1000,9999)}", thread["title"], thread["question"],
        )
        thread_id = row["id"]

        # Create embeddings for each thread
        await store_embedding(
            org_id=org_id,
            content_type="support_thread",
            content_id=thread_id,
            content_text=f"{thread['title']}\n\n{thread['question']}",
        )
        print(f"  Created thread + embedding: {thread['title'][:50]}")

    # Create demo documentation
    docs = [
        {"title": "CockroachDB MCP Server Setup Guide", "content": "# Setting Up CockroachDB MCP\n\n## Prerequisites\n- CockroachDB Cloud account\n- Claude Code installed\n\n## Steps\n1. Go to Cloud Console\n2. Navigate to MCP section\n3. Copy connection string\n4. Configure in Claude Code\n\n## Troubleshooting\n- Check SSL certificates\n- Verify network access", "doc_type": "howto"},
        {"title": "Vector Search Optimization", "content": "# Optimizing CockroachDB Vector Search\n\n## Index Configuration\nUse HNSW index for better performance:\n```sql\nCREATE INDEX ON embeddings USING vector (embedding vector_cosine_ops) WITH (lists = 100);\n```\n\n## Query Optimization\n- Limit results with LIMIT\n- Use WHERE clauses to filter before vector search", "doc_type": "tutorial"},
    ]

    for doc in docs:
        row = await fetch_one(
            "INSERT INTO documentation (org_id, title, content, doc_type, status, confidence_score) "
            "VALUES ($1, $2, $3, $4, 'approved', 0.85) RETURNING id::text",
            org_id, doc["title"], doc["content"], doc["doc_type"],
        )
        doc_id = row["id"]

        await store_embedding(
            org_id=org_id,
            content_type="documentation",
            content_id=doc_id,
            content_text=f"{doc['title']}\n\n{doc['content']}",
        )
        print(f"  Created doc + embedding: {doc['title']}")

    print(f"\n✅ Seeded {len(SUPPORT_THREADS)} threads + {len(docs)} docs for org {org_id}")

    await pool.close()


if __name__ == "__main__":
    asyncio.run(seed())
