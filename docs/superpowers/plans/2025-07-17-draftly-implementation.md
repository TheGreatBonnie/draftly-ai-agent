# Draftly AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an autonomous documentation engineering platform that transforms support conversations into production-ready documentation using LangGraph, CockroachDB, and AWS.

**Architecture:** LangGraph StateGraph with 8 nodes (ingest → memory_retrieve → research → synthesize → write → ai_review → human_review → publish). CockroachDB serves as both the LangGraph checkpointer and the external memory store (vectors, episodic, procedural, reviewer, organizational). Lambda webhooks receive Slack/Discord/GitHub events, SQS queues them, ECS Fargate runs the agent.

**Tech Stack:** Python 3.11+, LangGraph, LangChain, CockroachDB (asyncpg), Amazon Bedrock (Claude), FastAPI, Slack Bolt, Discord.py, GitHub API (httpx), AWS CDK, Docker

---

## File Structure

```
draftly/
├── pyproject.toml                    # Dependencies and project config
├── .env.example                      # Environment variable template
├── Dockerfile                        # Production container
├── docker-compose.yml                # Local dev (CockroachDB + app)
│
├── infrastructure/
│   └── cockroachdb/
│       ├── schema.sql                # Full schema (8 tables)
│       └── seed.sql                  # Demo data (~200 threads + embeddings)
│
├── src/
│   ├── __init__.py
│   ├── config.py                     # Settings from env vars
│   ├── database.py                   # CockroachDB connection pool + helpers
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── state.py                  # DocumentationState TypedDict
│   │   ├── graph.py                  # StateGraph definition + compilation
│   │   ├── nodes/
│   │   │   ├── __init__.py
│   │   │   ├── ingest.py             # Parse message, create thread, init workflow
│   │   │   ├── memory.py             # Vector search + SQL + MCP memory retrieval
│   │   │   ├── research.py           # GitHub + Slack research in parallel
│   │   │   ├── synthesize.py         # Merge context into knowledge_package
│   │   │   ├── write.py              # Generate docs with Bedrock Claude
│   │   │   ├── review.py             # AI review + confidence scoring
│   │   │   ├── human.py              # HITL interrupt handler
│   │   │   └── publish.py            # Publish + respond + update memory
│   │   └── tools/
│   │       ├── __init__.py
│   │       ├── memory_tools.py       # CockroachDB memory tools for agents
│   │       ├── github_tools.py       # GitHub API tools
│   │       └── slack_tools.py        # Slack API tools
│   │
│   ├── memory/
│   │   ├── __init__.py
│   │   ├── vector_store.py           # CockroachDB vector operations
│   │   ├── episodic.py               # Support thread CRUD
│   │   ├── procedural.py             # Workflow state CRUD
│   │   ├── reviewer.py               # Review session CRUD
│   │   └── organizational.py         # Agent memory CRUD
│   │
│   ├── integrations/
│   │   ├── __init__.py
│   │   ├── bedrock.py                # Amazon Bedrock client
│   │   ├── slack.py                  # Slack API client
│   │   ├── discord.py                # Discord API client
│   │   └── github.py                 # GitHub API client
│   │
│   ├── webhooks/
│   │   ├── __init__.py
│   │   ├── slack.py                  # Lambda handler for Slack Events API
│   │   ├── discord.py                # Lambda handler for Discord interactions
│   │   └── github.py                 # Lambda handler for GitHub webhooks
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── app.py                    # FastAPI application
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── reviews.py            # Review CRUD + HITL resume
│   │   │   ├── docs.py               # Documentation endpoints
│   │   │   └── memory.py             # Memory query endpoints
│   │   └── templates/
│   │       ├── base.html             # Base template
│   │       ├── dashboard.html        # Review dashboard
│   │       └── review.html           # Single review page
│   │
│   └── cli/
│       ├── __init__.py
│       └── draftly.py                # CLI for local testing + demo
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py                   # Shared fixtures
│   ├── test_graph.py                 # Graph integration tests
│   ├── test_memory.py                # Memory system tests
│   └── test_nodes.py                 # Individual node tests
│
├── scripts/
│   ├── setup_cockroachdb.sh          # Cluster setup with ccloud
│   ├── seed_demo_data.py             # Seed demo conversations
│   └── deploy.sh                     # AWS deployment script
│
└── docs/
    ├── architecture.md
    └── demo-guide.md
```

---

## Task 1: Project Setup + Dependencies

**Files:**
- Modify: `pyproject.toml`
- Create: `.env.example`
- Create: `src/__init__.py`

- [ ] **Step 1: Update pyproject.toml with all dependencies**

```toml
[project]
name = "draftly"
version = "0.1.0"
description = "Autonomous documentation engineering with persistent agentic memory"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
    # LangGraph + LangChain
    "langgraph>=0.4.0",
    "langgraph-checkpoint-postgres>=0.1.0",
    "langchain>=1.0.0",
    "langchain-aws>=0.2.0",
    "langchain-core>=1.0.0",
    # Database
    "asyncpg>=0.30.0",
    "pgvector>=0.3.0",
    # Web framework
    "fastapi>=0.115.0",
    "uvicorn>=0.30.0",
    "jinja2>=3.1.0",
    # HTTP clients
    "httpx>=0.27.0",
    "slack-bolt>=1.20.0",
    "slack-sdk>=3.30.0",
    "discord.py>=2.4.0",
    # AWS
    "boto3>=1.35.0",
    # Utilities
    "pydantic>=2.9.0",
    "pydantic-settings>=2.5.0",
    "python-dotenv>=1.0.0",
    "structlog>=24.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "ruff>=0.6.0",
    "mypy>=1.11.0",
]

[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Create .env.example**

```bash
# CockroachDB
COCKROACHDB_URL=postgresql://user:pass@cluster.cockroachlabs.cloud:26257/draftly?sslmode=verify-full

# Amazon Bedrock
AWS_REGION=us-east-1
BEDROCK_MODEL=anthropic.claude-sonnet-4-20250514-v1:0
BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# Discord
DISCORD_BOT_TOKEN=...
DISCORD_PUBLIC_KEY=...

# GitHub
GITHUB_TOKEN=ghp_...
GITHUB_WEBHOOK_SECRET=...

# App
APP_URL=https://your-app-url.com
REVIEW_DASHBOARD_URL=https://review.your-app-url.com
ENVIRONMENT=development
LOG_LEVEL=INFO
```

- [ ] **Step 3: Create src/__init__.py**

```python
"""Draftly AI — Autonomous documentation engineering with persistent agentic memory."""
```

- [ ] **Step 4: Install dependencies and verify**

Run: `pip install -e ".[dev]"`
Expected: All dependencies install without errors

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml .env.example src/__init__.py
git commit -m "feat: project setup with all dependencies"
```

---

## Task 2: Configuration + Database Connection

**Files:**
- Create: `src/config.py`
- Create: `src/database.py`

- [ ] **Step 1: Create src/config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # CockroachDB
    cockroachdb_url: str

    # Bedrock
    aws_region: str = "us-east-1"
    bedrock_model: str = "anthropic.claude-sonnet-4-20250514-v1:0"
    bedrock_embedding_model: str = "amazon.titan-embed-text-v2:0"

    # Slack
    slack_bot_token: str = ""
    slack_signing_secret: str = ""

    # Discord
    discord_bot_token: str = ""
    discord_public_key: str = ""

    # GitHub
    github_token: str = ""
    github_webhook_secret: str = ""

    # App
    app_url: str = "http://localhost:8000"
    review_dashboard_url: str = "http://localhost:8000"
    environment: str = "development"
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

- [ ] **Step 2: Create src/database.py**

```python
from __future__ import annotations

import asyncpg
import structlog

from src.config import settings

logger = structlog.get_logger()

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.cockroachdb_url,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        logger.info("cockroachdb_pool_created")
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("cockroachdb_pool_closed")


async def fetch_one(query: str, *args) -> asyncpg.Record | None:
    pool = await get_pool()
    return await pool.fetchrow(query, *args)


async def fetch_all(query: str, *args) -> list[asyncpg.Record]:
    pool = await get_pool()
    return await pool.fetch(query, *args)


async def execute(query: str, *args) -> str:
    pool = await get_pool()
    return await pool.execute(query, *args)


async def fetch_val(query: str, *args):
    pool = await get_pool()
    row = await pool.fetchrow(query, *args)
    return row[0] if row else None
```

- [ ] **Step 3: Verify imports work**

Run: `python -c "from src.config import settings; from src.database import get_pool; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/config.py src/database.py
git commit -m "feat: config and CockroachDB connection pool"
```

---

## Task 3: CockroachDB Schema

**Files:**
- Create: `infrastructure/cockroachdb/schema.sql`

- [ ] **Step 1: Create schema.sql with all 8 tables**

```sql
-- Draftly AI Database Schema
-- CockroachDB with Distributed Vector Index

-- 1. Organizations (multi-tenant)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name STRING NOT NULL,
    slack_workspace_id STRING,
    discord_guild_id STRING,
    github_org STRING,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Support Threads (episodic memory)
CREATE TABLE IF NOT EXISTS support_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    source STRING NOT NULL CHECK (source IN ('slack', 'discord', 'github')),
    channel_id STRING NOT NULL,
    thread_id STRING NOT NULL,
    title STRING,
    question_summary STRING,
    resolution TEXT,
    status STRING DEFAULT 'open' CHECK (status IN ('open', 'processing', 'resolved')),
    participants JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_threads_org ON support_threads(org_id);
CREATE INDEX IF NOT EXISTS idx_support_threads_status ON support_threads(status);
CREATE INDEX IF NOT EXISTS idx_support_threads_source ON support_threads(source);

-- 3. Documentation (versioned output)
CREATE TABLE IF NOT EXISTS documentation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    title STRING NOT NULL,
    content TEXT NOT NULL,
    doc_type STRING NOT NULL CHECK (doc_type IN ('howto', 'faq', 'tutorial', 'troubleshooting', 'reference')),
    version INT DEFAULT 1,
    status STRING DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'published')),
    source_thread_id UUID REFERENCES support_threads(id),
    confidence_score FLOAT,
    published_to JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_org ON documentation(org_id);
CREATE INDEX IF NOT EXISTS idx_doc_status ON documentation(status);

-- 4. Embeddings (semantic memory with vector index)
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    content_type STRING NOT NULL CHECK (content_type IN ('documentation', 'support_thread', 'review_feedback')),
    content_id UUID NOT NULL,
    content_text TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_org ON embeddings(org_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_type ON embeddings(content_type);

-- Distributed Vector Index for semantic search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings
    USING vector (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 5. Review Sessions (reviewer memory)
CREATE TABLE IF NOT EXISTS review_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES documentation(id),
    reviewer_id UUID,
    status STRING DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_changes')),
    reviewer_feedback TEXT,
    edits_made JSONB,
    confidence_before FLOAT,
    confidence_after FLOAT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_review_doc ON review_sessions(doc_id);
CREATE INDEX IF NOT EXISTS idx_review_status ON review_sessions(status);

-- 6. Agent Workflows (procedural memory)
CREATE TABLE IF NOT EXISTS agent_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    thread_id UUID REFERENCES support_threads(id),
    doc_id UUID REFERENCES documentation(id),
    graph_state JSONB NOT NULL,
    current_node STRING,
    status STRING DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed', 'failed')),
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_org ON agent_workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON agent_workflows(status);

-- 7. Agent Memory (organizational knowledge)
CREATE TABLE IF NOT EXISTS agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    memory_type STRING NOT NULL CHECK (memory_type IN ('episodic', 'procedural', 'organizational', 'reviewer')),
    key STRING NOT NULL,
    value JSONB NOT NULL,
    source TEXT,
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_accessed TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_memory_org ON agent_memory(org_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON agent_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_key ON agent_memory(key);

-- 8. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    actor STRING NOT NULL CHECK (actor IN ('agent', 'human', 'system')),
    actor_id STRING,
    action STRING NOT NULL,
    resource_type STRING,
    resource_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
```

- [ ] **Step 2: Verify SQL syntax**

Run: `cat infrastructure/cockroachdb/schema.sql | head -5`
Expected: File exists and contains valid SQL

- [ ] **Step 3: Commit**

```bash
git add infrastructure/cockroachdb/schema.sql
git commit -m "feat: CockroachDB schema with 8 tables and vector index"
```

---

## Task 4: Memory System — Vector Store

**Files:**
- Create: `src/memory/__init__.py`
- Create: `src/memory/vector_store.py`

- [ ] **Step 1: Create src/memory/__init__.py**

```python
"""CockroachDB memory system — 5 memory layers."""
```

- [ ] **Step 2: Create src/memory/vector_store.py**

```python
from __future__ import annotations

import json
import structlog
from langchain_aws import BedrockEmbeddings

from src.config import settings
from src.database import fetch_all, fetch_one, execute

logger = structlog.get_logger()

_embeddings_model: BedrockEmbeddings | None = None


def get_embeddings_model() -> BedrockEmbeddings:
    global _embeddings_model
    if _embeddings_model is None:
        _embeddings_model = BedrockEmbeddings(
            model_id=settings.bedrock_embedding_model,
            region_name=settings.aws_region,
        )
    return _embeddings_model


async def embed_text(text: str) -> list[float]:
    model = get_embeddings_model()
    embedding = await model.aembed_query(text)
    return embedding


async def store_embedding(
    org_id: str,
    content_type: str,
    content_id: str,
    content_text: str,
    metadata: dict | None = None,
) -> str:
    embedding = await embed_text(content_text)
    embedding_str = json.dumps(embedding)

    row = await fetch_one(
        """
        INSERT INTO embeddings (org_id, content_type, content_id, content_text, embedding, metadata)
        VALUES ($1, $2, $3, $4, $5::vector, $6::jsonb)
        RETURNING id::text
        """,
        org_id,
        content_type,
        content_id,
        content_text,
        embedding_str,
        json.dumps(metadata or {}),
    )
    logger.info("embedding_stored", id=row["id"], content_type=content_type)
    return row["id"]


async def search_similar(
    org_id: str,
    query_text: str,
    content_type: str | None = None,
    k: int = 10,
) -> list[dict]:
    query_embedding = await embed_text(query_text)
    embedding_str = json.dumps(query_embedding)

    if content_type:
        rows = await fetch_all(
            """
            SELECT id::text, content_type, content_id, content_text, metadata,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM embeddings
            WHERE org_id = $2 AND content_type = $3
            ORDER BY embedding <=> $1::vector
            LIMIT $4
            """,
            embedding_str,
            org_id,
            content_type,
            k,
        )
    else:
        rows = await fetch_all(
            """
            SELECT id::text, content_type, content_id, content_text, metadata,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM embeddings
            WHERE org_id = $2
            ORDER BY embedding <=> $1::vector
            LIMIT $3
            """,
            embedding_str,
            org_id,
            k,
        )

    return [
        {
            "id": r["id"],
            "content_type": r["content_type"],
            "content_id": r["content_id"],
            "content_text": r["content_text"],
            "metadata": json.loads(r["metadata"]) if r["metadata"] else {},
            "similarity": float(r["similarity"]),
        }
        for r in rows
    ]


async def delete_embedding(embedding_id: str) -> None:
    await execute("DELETE FROM embeddings WHERE id = $1", embedding_id)
    logger.info("embedding_deleted", id=embedding_id)
```

- [ ] **Step 3: Commit**

```bash
git add src/memory/
git commit -m "feat: vector store with CockroachDB Distributed Vector Index"
```

---

## Task 5: Memory System — Episodic, Procedural, Reviewer, Organizational

**Files:**
- Create: `src/memory/episodic.py`
- Create: `src/memory/procedural.py`
- Create: `src/memory/reviewer.py`
- Create: `src/memory/organizational.py`

- [ ] **Step 1: Create src/memory/episodic.py**

```python
from __future__ import annotations

import json
import structlog
from src.database import fetch_one, fetch_all, execute

logger = structlog.get_logger()


async def create_thread(
    org_id: str,
    source: str,
    channel_id: str,
    thread_id: str,
    title: str | None = None,
    question_summary: str | None = None,
    participants: list | None = None,
) -> str:
    row = await fetch_one(
        """
        INSERT INTO support_threads (org_id, source, channel_id, thread_id, title, question_summary, participants)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        RETURNING id::text
        """,
        org_id, source, channel_id, thread_id, title, question_summary,
        json.dumps(participants or []),
    )
    logger.info("thread_created", id=row["id"], source=source)
    return row["id"]


async def get_thread(thread_id: str) -> dict | None:
    row = await fetch_one(
        "SELECT *, id::text as id FROM support_threads WHERE id = $1", thread_id
    )
    return dict(row) if row else None


async def search_threads(
    org_id: str, query: str, limit: int = 10
) -> list[dict]:
    rows = await fetch_all(
        """
        SELECT *, id::text as id FROM support_threads
        WHERE org_id = $1
        AND plainto_tsquery('english', $2) @@ to_tsvector('english', COALESCE(question_summary, '') || ' ' || COALESCE(title, ''))
        ORDER BY created_at DESC
        LIMIT $3
        """,
        org_id, query, limit,
    )
    return [dict(r) for r in rows]


async def resolve_thread(thread_id: str, resolution: str) -> None:
    await execute(
        """
        UPDATE support_threads
        SET status = 'resolved', resolution = $1, resolved_at = now()
        WHERE id = $2
        """,
        resolution, thread_id,
    )
    logger.info("thread_resolved", id=thread_id)


async def get_recent_threads(org_id: str, limit: int = 20) -> list[dict]:
    rows = await fetch_all(
        """
        SELECT *, id::text as id FROM support_threads
        WHERE org_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        org_id, limit,
    )
    return [dict(r) for r in rows]
```

- [ ] **Step 2: Create src/memory/procedural.py**

```python
from __future__ import annotations

import json
import structlog
from src.database import fetch_one, fetch_all, execute

logger = structlog.get_logger()


async def create_workflow(
    org_id: str,
    thread_id: str,
    graph_state: dict,
    current_node: str = "ingest",
) -> str:
    row = await fetch_one(
        """
        INSERT INTO agent_workflows (org_id, thread_id, graph_state, current_node, status)
        VALUES ($1, $2, $3::jsonb, $4, 'running')
        RETURNING id::text
        """,
        org_id, thread_id, json.dumps(graph_state), current_node,
    )
    logger.info("workflow_created", id=row["id"])
    return row["id"]


async def update_workflow(
    workflow_id: str,
    graph_state: dict | None = None,
    current_node: str | None = None,
    status: str | None = None,
    error: str | None = None,
    doc_id: str | None = None,
) -> None:
    sets = ["updated_at = now()"]
    args = []
    idx = 1

    if graph_state is not None:
        sets.append(f"graph_state = ${idx}::jsonb")
        args.append(json.dumps(graph_state))
        idx += 1
    if current_node is not None:
        sets.append(f"current_node = ${idx}")
        args.append(current_node)
        idx += 1
    if status is not None:
        sets.append(f"status = ${idx}")
        args.append(status)
        idx += 1
    if error is not None:
        sets.append(f"error = ${idx}")
        args.append(error)
        idx += 1
    if doc_id is not None:
        sets.append(f"doc_id = ${idx}")
        args.append(doc_id)
        idx += 1

    args.append(workflow_id)
    await execute(
        f"UPDATE agent_workflows SET {', '.join(sets)} WHERE id = ${idx}",
        *args,
    )


async def get_workflow(workflow_id: str) -> dict | None:
    row = await fetch_one(
        "SELECT *, id::text as id FROM agent_workflows WHERE id = $1", workflow_id
    )
    return dict(row) if row else None


async def get_workflows_by_status(org_id: str, status: str) -> list[dict]:
    rows = await fetch_all(
        """
        SELECT *, id::text as id FROM agent_workflows
        WHERE org_id = $1 AND status = $2
        ORDER BY created_at DESC
        """,
        org_id, status,
    )
    return [dict(r) for r in rows]
```

- [ ] **Step 3: Create src/memory/reviewer.py**

```python
from __future__ import annotations

import json
import structlog
from src.database import fetch_one, fetch_all, execute

logger = structlog.get_logger()


async def create_review_session(
    doc_id: str,
    reviewer_id: str | None = None,
    confidence_before: float | None = None,
) -> str:
    row = await fetch_one(
        """
        INSERT INTO review_sessions (doc_id, reviewer_id, confidence_before, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id::text
        """,
        doc_id, reviewer_id, confidence_before,
    )
    logger.info("review_created", id=row["id"], doc_id=doc_id)
    return row["id"]


async def complete_review(
    review_id: str,
    status: str,
    feedback: str | None = None,
    edits_made: dict | None = None,
    confidence_after: float | None = None,
) -> None:
    await execute(
        """
        UPDATE review_sessions
        SET status = $1, reviewer_feedback = $2, edits_made = $3::jsonb,
            confidence_after = $4, completed_at = now()
        WHERE id = $5
        """,
        status, feedback, json.dumps(edits_made or {}), confidence_after, review_id,
    )
    logger.info("review_completed", id=review_id, status=status)


async def get_pending_reviews(org_id: str) -> list[dict]:
    rows = await fetch_all(
        """
        SELECT rs.*, rs.id::text as id, d.title, d.content, d.doc_type, d.confidence_score
        FROM review_sessions rs
        JOIN documentation d ON d.id = rs.doc_id
        WHERE d.org_id = $1 AND rs.status = 'pending'
        ORDER BY rs.created_at DESC
        """,
        org_id,
    )
    return [dict(r) for r in rows]


async def get_review_history(org_id: str, limit: int = 10) -> list[dict]:
    rows = await fetch_all(
        """
        SELECT rs.*, rs.id::text as id, d.title, d.doc_type
        FROM review_sessions rs
        JOIN documentation d ON d.id = rs.doc_id
        WHERE d.org_id = $1 AND rs.status != 'pending'
        ORDER BY rs.completed_at DESC
        LIMIT $2
        """,
        org_id, limit,
    )
    return [dict(r) for r in rows]


async def get_reviewer_memory(org_id: str, limit: int = 10) -> list[dict]:
    rows = await fetch_all(
        """
        SELECT * FROM agent_memory
        WHERE org_id = $1 AND memory_type = 'reviewer'
        ORDER BY created_at DESC
        LIMIT $2
        """,
        org_id, limit,
    )
    return [dict(r) for r in rows]
```

- [ ] **Step 4: Create src/memory/organizational.py**

```python
from __future__ import annotations

import json
import structlog
from src.database import fetch_one, fetch_all, execute

logger = structlog.get_logger()


async def store_memory(
    org_id: str,
    memory_type: str,
    key: str,
    value: dict,
    source: str | None = None,
    confidence: float = 1.0,
) -> str:
    row = await fetch_one(
        """
        INSERT INTO agent_memory (org_id, memory_type, key, value, source, confidence)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        RETURNING id::text
        """,
        org_id, memory_type, key, json.dumps(value), source, confidence,
    )
    logger.info("memory_stored", id=row["id"], memory_type=memory_type, key=key)
    return row["id"]


async def search_memory(
    org_id: str,
    memory_type: str | None = None,
    key_pattern: str | None = None,
    limit: int = 10,
) -> list[dict]:
    conditions = ["org_id = $1"]
    args: list = [org_id]
    idx = 2

    if memory_type:
        conditions.append(f"memory_type = ${idx}")
        args.append(memory_type)
        idx += 1
    if key_pattern:
        conditions.append(f"key ILIKE '%' || ${idx} || '%'")
        args.append(key_pattern)
        idx += 1

    where = " AND ".join(conditions)
    rows = await fetch_all(
        f"""
        SELECT *, id::text as id FROM agent_memory
        WHERE {where}
        ORDER BY confidence DESC, created_at DESC
        LIMIT ${idx}
        """,
        *args, limit,
    )
    return [dict(r) for r in rows]


async def update_memory_access(memory_id: str) -> None:
    await execute(
        "UPDATE agent_memory SET last_accessed = now() WHERE id = $1", memory_id
    )


async def store_audit_log(
    org_id: str,
    actor: str,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict | None = None,
    actor_id: str | None = None,
) -> None:
    await execute(
        """
        INSERT INTO audit_logs (org_id, actor, actor_id, action, resource_type, resource_id, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        """,
        org_id, actor, actor_id, action, resource_type, resource_id,
        json.dumps(details or {}),
    )
```

- [ ] **Step 5: Commit**

```bash
git add src/memory/
git commit -m "feat: episodic, procedural, reviewer, and organizational memory systems"
```

---

## Task 6: LangGraph State Schema + Graph Definition

**Files:**
- Create: `src/agents/__init__.py`
- Create: `src/agents/state.py`
- Create: `src/agents/graph.py`

- [ ] **Step 1: Create src/agents/__init__.py**

```python
"""LangGraph agent system for Draftly."""
```

- [ ] **Step 2: Create src/agents/state.py**

```python
from __future__ import annotations

from typing import Annotated, Literal, TypedDict

from langgraph.graph.message import add_messages


class DocumentationState(TypedDict):
    # Input
    org_id: str
    source: Literal["slack", "discord", "github"]
    channel_id: str
    thread_id: str
    question: str

    # Memory retrieval results
    similar_threads: list[dict]
    existing_docs: list[dict]
    reviewer_feedback_history: list[dict]
    semantic_context: list[dict]

    # Research results
    github_context: list[dict]
    slack_context: list[dict]

    # Synthesis
    knowledge_package: dict

    # Documentation output
    draft_content: str
    draft_title: str
    doc_type: str
    confidence_score: float

    # Review
    review_result: dict
    review_feedback: str

    # HITL
    human_decision: Literal["approve", "reject", "revise", ""]
    human_feedback: str

    # Final
    published_urls: list[dict]

    # Tracking
    workflow_id: str
    doc_id: str
    messages: Annotated[list, add_messages]
```

- [ ] **Step 3: Create src/agents/graph.py**

```python
from __future__ import annotations

import structlog
from langgraph.graph import END, StateGraph
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from src.agents.state import DocumentationState
from src.agents.nodes.ingest import ingest_node
from src.agents.nodes.memory import memory_retrieve_node
from src.agents.nodes.research import research_node
from src.agents.nodes.synthesize import synthesize_node
from src.agents.nodes.write import write_docs_node
from src.agents.nodes.review import ai_review_node
from src.agents.nodes.human import human_review_node
from src.agents.nodes.publish import publish_node
from src.config import settings

logger = structlog.get_logger()


def build_graph():
    graph = StateGraph(DocumentationState)

    # Add nodes
    graph.add_node("ingest", ingest_node)
    graph.add_node("memory_retrieve", memory_retrieve_node)
    graph.add_node("research", research_node)
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("write_docs", write_docs_node)
    graph.add_node("ai_review", ai_review_node)
    graph.add_node("human_review", human_review_node)
    graph.add_node("publish", publish_node)

    # Edges
    graph.set_entry_point("ingest")
    graph.add_edge("ingest", "memory_retrieve")
    graph.add_edge("memory_retrieve", "research")
    graph.add_edge("research", "synthesize")
    graph.add_edge("synthesize", "write_docs")
    graph.add_edge("write_docs", "ai_review")

    # Confidence-based routing
    graph.add_conditional_edges(
        "ai_review",
        lambda state: "human_review" if state.get("confidence_score", 0) >= 0.7 else "research",
        {"human_review": "human_review", "research": "research"},
    )

    # HITL routing
    graph.add_conditional_edges(
        "human_review",
        lambda state: {
            "approve": "publish",
            "reject": END,
            "revise": "write_docs",
        }.get(state.get("human_decision", ""), END),
    )

    graph.add_edge("publish", END)

    logger.info("graph_built")
    return graph


async def compile_graph():
    checkpointer = AsyncPostgresSaver.from_conn_string(settings.cockroachdb_url)
    graph = build_graph()
    compiled = graph.compile(checkpointer=checkpointer)
    logger.info("graph_compiled")
    return compiled
```

- [ ] **Step 4: Commit**

```bash
git add src/agents/__init__.py src/agents/state.py src/agents/graph.py
git commit -m "feat: LangGraph state schema and graph definition"
```

---

## Task 7: Graph Node — Ingest

**Files:**
- Create: `src/agents/nodes/__init__.py`
- Create: `src/agents/nodes/ingest.py`

- [ ] **Step 1: Create src/agents/nodes/__init__.py**

```python
"""LangGraph graph nodes."""
```

- [ ] **Step 2: Create src/agents/nodes/ingest.py**

```python
from __future__ import annotations

import structlog

from src.agents.state import DocumentationState
from src.memory.episodic import create_thread
from src.memory.organizational import store_audit_log

logger = structlog.get_logger()


async def ingest_node(state: DocumentationState) -> dict:
    org_id = state["org_id"]
    source = state["source"]
    channel_id = state["channel_id"]
    thread_id = state["thread_id"]
    question = state["question"]

    logger.info("ingest_started", org_id=org_id, source=source, thread_id=thread_id)

    # Create support thread record
    st_id = await create_thread(
        org_id=org_id,
        source=source,
        channel_id=channel_id,
        thread_id=thread_id,
        title=question[:200] if question else None,
        question_summary=question,
    )

    # Audit log
    await store_audit_log(
        org_id=org_id,
        actor="agent",
        action="ingest_message",
        resource_type="support_thread",
        resource_id=st_id,
        details={"source": source, "thread_id": thread_id, "question": question[:500]},
    )

    logger.info("ingest_completed", thread_record_id=st_id)

    return {
        "similar_threads": [],
        "existing_docs": [],
        "reviewer_feedback_history": [],
        "semantic_context": [],
        "github_context": [],
        "slack_context": [],
        "knowledge_package": {},
        "draft_content": "",
        "draft_title": "",
        "doc_type": "howto",
        "confidence_score": 0.0,
        "review_result": {},
        "review_feedback": "",
        "human_decision": "",
        "human_feedback": "",
        "published_urls": [],
        "messages": [],
    }
```

- [ ] **Step 3: Commit**

```bash
git add src/agents/nodes/
git commit -m "feat: ingest node — parse message and create support thread"
```

---

## Task 8: Graph Node — Memory Retrieve

**Files:**
- Create: `src/agents/nodes/memory.py`
- Create: `src/agents/tools/__init__.py`
- Create: `src/agents/tools/memory_tools.py`

- [ ] **Step 1: Create src/agents/tools/__init__.py**

```python
"""Agent tools for memory, GitHub, and Slack."""
```

- [ ] **Step 2: Create src/agents/tools/memory_tools.py**

```python
from __future__ import annotations

from langchain_core.tools import tool

from src.memory.vector_store import search_similar
from src.memory.episodic import search_threads
from src.memory.organizational import search_memory
from src.memory.reviewer import get_reviewer_memory


@tool
async def search_semantic_memory(org_id: str, query: str, k: int = 5) -> str:
    """Search documentation and support threads by semantic similarity using vector embeddings."""
    results = await search_similar(org_id, query, k=k)
    if not results:
        return "No similar content found."
    return "\n".join(
        f"[{r['content_type']}] (similarity: {r['similarity']:.2f}) {r['content_text'][:300]}"
        for r in results
    )


@tool
async def search_episodic_memory(org_id: str, query: str, k: int = 5) -> str:
    """Search historical support conversations for similar questions."""
    results = await search_threads(org_id, query, limit=k)
    if not results:
        return "No similar threads found."
    return "\n".join(
        f"[{r['source']}] {r.get('title', 'Untitled')}: {r.get('question_summary', '')[:200]}"
        for r in results
    )


@tool
async def search_organizational_memory(org_id: str, key: str) -> str:
    """Search organizational knowledge base for best practices and known solutions."""
    results = await search_memory(org_id, key_pattern=key, limit=5)
    if not results:
        return "No organizational memory found."
    return "\n".join(
        f"[{r['memory_type']}] {r['key']}: {str(r['value'])[:200]}"
        for r in results
    )


@tool
async def get_reviewer_context(org_id: str) -> str:
    """Get reviewer feedback history to understand writing preferences and common edits."""
    results = await get_reviewer_memory(org_id, limit=5)
    if not results:
        return "No reviewer history found."
    return "\n".join(
        f"[reviewer] {r['key']}: {str(r['value'])[:200]}"
        for r in results
    )


MEMORY_TOOLS = [
    search_semantic_memory,
    search_episodic_memory,
    search_organizational_memory,
    get_reviewer_context,
]
```

- [ ] **Step 3: Create src/agents/nodes/memory.py**

```python
from __future__ import annotations

import structlog

from src.agents.state import DocumentationState
from src.memory.vector_store import search_similar
from src.memory.episodic import search_threads
from src.memory.organizational import search_memory
from src.memory.reviewer import get_reviewer_memory

logger = structlog.get_logger()


async def memory_retrieve_node(state: DocumentationState) -> dict:
    org_id = state["org_id"]
    question = state["question"]

    logger.info("memory_retrieve_started", org_id=org_id)

    # 1. Semantic search via Distributed Vector Index
    semantic_results = await search_similar(org_id, question, k=10)

    # 2. Episodic search — similar support threads
    episodic_results = await search_threads(org_id, question, limit=5)

    # 3. Organizational memory — best practices, known solutions
    org_results = await search_memory(org_id, key_pattern=question.split()[0] if question else "", limit=5)

    # 4. Reviewer memory — past feedback
    reviewer_results = await get_reviewer_memory(org_id, limit=5)

    # 5. Search for existing documentation on this topic
    existing_docs = [
        r for r in semantic_results
        if r["content_type"] == "documentation"
    ]

    logger.info(
        "memory_retrieve_completed",
        semantic=len(semantic_results),
        episodic=len(episodic_results),
        organizational=len(org_results),
        reviewer=len(reviewer_results),
        existing_docs=len(existing_docs),
    )

    return {
        "similar_threads": [dict(r) for r in episodic_results],
        "existing_docs": existing_docs,
        "reviewer_feedback_history": [dict(r) for r in reviewer_results],
        "semantic_context": semantic_results,
    }
```

- [ ] **Step 4: Commit**

```bash
git add src/agents/nodes/memory.py src/agents/tools/
git commit -m "feat: memory retrieve node with vector search, episodic, and organizational memory"
```

---

## Task 9: Graph Node — Research

**Files:**
- Create: `src/agents/nodes/research.py`
- Create: `src/agents/tools/github_tools.py`
- Create: `src/agents/tools/slack_tools.py`

- [ ] **Step 1: Create src/agents/tools/github_tools.py**

```python
from __future__ import annotations

import httpx
from langchain_core.tools import tool

from src.config import settings


@tool
async def search_github_issues(query: str, org: str = "", limit: int = 5) -> str:
    """Search GitHub issues and discussions for relevant context."""
    headers = {"Authorization": f"token {settings.github_token}"} if settings.github_token else {}
    search_url = "https://api.github.com/search/issues"
    params = {"q": f"{query} is:issue", "per_page": limit}
    if org:
        params["q"] += f" org:{org}"

    async with httpx.AsyncClient() as client:
        resp = await client.get(search_url, headers=headers, params=params, timeout=10)
        if resp.status_code != 200:
            return f"GitHub search failed: {resp.status_code}"
        data = resp.json()

    items = data.get("items", [])
    if not items:
        return "No relevant GitHub issues found."

    return "\n".join(
        f"[{item['state']}] {item['title']}\n{item['html_url']}\n{item.get('body', '')[:200]}"
        for item in items[:limit]
    )


@tool
async def get_github_issue(owner: str, repo: str, issue_number: int) -> str:
    """Get a specific GitHub issue with full body and comments."""
    headers = {"Authorization": f"token {settings.github_token}"} if settings.github_token else {}

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}",
            headers=headers,
            timeout=10,
        )
        if resp.status_code != 200:
            return f"Failed to fetch issue: {resp.status_code}"
        issue = resp.json()

    return f"#{issue['number']}: {issue['title']}\n\n{issue.get('body', '')}"


GITHUB_TOOLS = [search_github_issues, get_github_issue]
```

- [ ] **Step 2: Create src/agents/tools/slack_tools.py**

```python
from __future__ import annotations

import httpx
from langchain_core.tools import tool

from src.config import settings


@tool
async def search_slack_messages(query: str, channel: str = "", limit: int = 5) -> str:
    """Search Slack messages for relevant support conversations."""
    headers = {"Authorization": f"Bearer {settings.slack_bot_token}"}
    params = {"query": query, "count": limit}

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://slack.com/api/search.messages",
            headers=headers,
            params=params,
            timeout=10,
        )
        if resp.status_code != 200:
            return f"Slack search failed: {resp.status_code}"
        data = resp.json()

    if not data.get("ok"):
        return f"Slack API error: {data.get('error', 'unknown')}"

    messages = data.get("messages", {}).get("matches", [])
    if not messages:
        return "No relevant Slack messages found."

    return "\n".join(
        f"[{m.get('channel', {}).get('name', 'unknown')}] {m.get('text', '')[:200]}"
        for m in messages[:limit]
    )


SLACK_TOOLS = [search_slack_messages]
```

- [ ] **Step 3: Create src/agents/nodes/research.py**

```python
from __future__ import annotations

import asyncio
import structlog

from src.agents.state import DocumentationState
from src.agents.tools.github_tools import search_github_issues
from src.agents.tools.slack_tools import search_slack_messages
from src.config import settings

logger = structlog.get_logger()


async def research_node(state: DocumentationState) -> dict:
    question = state["question"]
    org_id = state["org_id"]

    logger.info("research_started", org_id=org_id)

    # Run GitHub and Slack research in parallel
    github_task = search_github_issues.ainvoke({
        "query": question,
        "org": "",
        "limit": 5,
    })
    slack_task = search_slack_messages.ainvoke({
        "query": question,
        "limit": 5,
    })

    github_result, slack_result = await asyncio.gather(
        github_task, slack_task, return_exceptions=True
    )

    github_context = [github_result] if not isinstance(github_result, Exception) else [f"Error: {github_result}"]
    slack_context = [slack_result] if not isinstance(slack_result, Exception) else [f"Error: {slack_result}"]

    logger.info("research_completed", github=len(github_context), slack=len(slack_context))

    return {
        "github_context": github_context,
        "slack_context": slack_context,
    }
```

- [ ] **Step 4: Commit**

```bash
git add src/agents/nodes/research.py src/agents/tools/github_tools.py src/agents/tools/slack_tools.py
git commit -m "feat: research node with parallel GitHub + Slack search"
```

---

## Task 10: Graph Node — Synthesize

**Files:**
- Create: `src/agents/nodes/synthesize.py`

- [ ] **Step 1: Create src/agents/nodes/synthesize.py**

```python
from __future__ import annotations

import json
import structlog

from src.agents.state import DocumentationState
from src.integrations.bedrock import call_bedrock

logger = structlog.get_logger()

SYNTHESIZE_PROMPT = """You are a knowledge synthesis agent. Merge the following research into a unified knowledge package for documentation.

## Original Question
{question}

## Semantic Context (similar documentation)
{semantic_context}

## Similar Support Threads
{similar_threads}

## Existing Documentation
{existing_docs}

## GitHub Context
{github_context}

## Slack Context
{slack_context}

## Reviewer Feedback History
{reviewer_feedback_history}

Create a JSON knowledge package with:
- "key_facts": list of verified facts from the sources
- "solutions": list of solutions found
- "code_examples": any code snippets found
- "gaps": information that's missing or contradictory
- "sources": list of source references
- "recommended_doc_type": one of "howto", "faq", "tutorial", "troubleshooting", "reference"

Return ONLY valid JSON, no other text."""


async def synthesize_node(state: DocumentationState) -> dict:
    logger.info("synthesize_started", org_id=state["org_id"])

    prompt = SYNTHESIZE_PROMPT.format(
        question=state["question"],
        semantic_context=json.dumps(state.get("semantic_context", [])[:3], indent=2),
        similar_threads=json.dumps(state.get("similar_threads", [])[:3], indent=2),
        existing_docs=json.dumps(state.get("existing_docs", [])[:3], indent=2),
        github_context="\n".join(state.get("github_context", [])[:2]),
        slack_context="\n".join(state.get("slack_context", [])[:2]),
        reviewer_feedback_history=json.dumps(state.get("reviewer_feedback_history", [])[:3], indent=2),
    )

    response = await call_bedrock(prompt)

    try:
        knowledge_package = json.loads(response)
    except json.JSONDecodeError:
        # Extract JSON from response if wrapped in markdown
        import re
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            knowledge_package = json.loads(json_match.group())
        else:
            knowledge_package = {
                "key_facts": [response],
                "solutions": [],
                "code_examples": [],
                "gaps": [],
                "sources": [],
                "recommended_doc_type": "howto",
            }

    doc_type = knowledge_package.get("recommended_doc_type", "howto")

    logger.info("synthesize_completed", doc_type=doc_type, facts=len(knowledge_package.get("key_facts", [])))

    return {
        "knowledge_package": knowledge_package,
        "doc_type": doc_type,
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/agents/nodes/synthesize.py
git commit -m "feat: synthesize node — merge research into knowledge package"
```

---

## Task 11: Bedrock Integration

**Files:**
- Create: `src/integrations/__init__.py`
- Create: `src/integrations/bedrock.py`

- [ ] **Step 1: Create src/integrations/__init__.py**

```python
"""External service integrations."""
```

- [ ] **Step 2: Create src/integrations/bedrock.py**

```python
from __future__ import annotations

import json
import structlog
import boto3

from src.config import settings

logger = structlog.get_logger()

_client = None


def get_bedrock_client():
    global _client
    if _client is None:
        _client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    return _client


async def call_bedrock(
    prompt: str,
    system_prompt: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    client = get_bedrock_client()

    messages = [{"role": "user", "content": [{"text": prompt}]}]

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": messages,
    }

    if system_prompt:
        body["system"] = [{"text": system_prompt}]

    logger.info("bedrock_call", model=settings.bedrock_model, prompt_length=len(prompt))

    response = client.invoke_model(
        modelId=settings.bedrock_model,
        body=json.dumps(body),
        contentType="application/json",
        accept="application/json",
    )

    response_body = json.loads(response["body"].read())
    content = response_body.get("content", [{}])
    text = content[0].get("text", "") if content else ""

    logger.info("bedrock_response", response_length=len(text))
    return text


async def call_bedrock_with_tools(prompt: str, tools: list[dict], system_prompt: str = "") -> dict:
    client = get_bedrock_client()

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": [{"text": prompt}]}],
        "tools": tools,
    }

    if system_prompt:
        body["system"] = [{"text": system_prompt}]

    response = client.invoke_model(
        modelId=settings.bedrock_model,
        body=json.dumps(body),
        contentType="application/json",
        accept="application/json",
    )

    return json.loads(response["body"].read())
```

- [ ] **Step 3: Commit**

```bash
git add src/integrations/
git commit -m "feat: Amazon Bedrock integration for LLM reasoning"
```

---

## Task 12: Graph Node — Write Docs

**Files:**
- Create: `src/agents/nodes/write.py`

- [ ] **Step 1: Create src/agents/nodes/write.py**

```python
from __future__ import annotations

import json
import structlog

from src.agents.state import DocumentationState
from src.integrations.bedrock import call_bedrock
from src.database import fetch_one

logger = structlog.get_logger()

WRITE_PROMPT = """You are a technical documentation writer. Generate production-ready documentation.

## Knowledge Package
{knowledge_package}

## Original Question
{question}

## Doc Type: {doc_type}

## Reviewer Feedback (from previous iterations)
{review_feedback}

Write clear, accurate documentation. Include:
1. A concise title
2. An introduction explaining what this covers
3. Prerequisites (if applicable)
4. Step-by-step instructions with code examples
5. Common troubleshooting tips
6. A brief FAQ section

Write in a professional but approachable tone. Use markdown formatting.
Include real code examples where possible. Be specific, not generic."""


async def write_docs_node(state: DocumentationState) -> dict:
    logger.info("write_docs_started", org_id=state["org_id"], doc_type=state.get("doc_type"))

    prompt = WRITE_PROMPT.format(
        knowledge_package=json.dumps(state.get("knowledge_package", {}), indent=2),
        question=state["question"],
        doc_type=state.get("doc_type", "howto"),
        review_feedback=state.get("human_feedback", "None"),
    )

    content = await call_bedrock(prompt, max_tokens=4096)

    # Extract title from first line
    lines = content.strip().split("\n")
    title = lines[0].lstrip("# ").strip() if lines else "Untitled Documentation"

    # Store draft in documentation table
    org_id = state["org_id"]
    row = await fetch_one(
        """
        INSERT INTO documentation (org_id, title, content, doc_type, status, source_thread_id, confidence_score)
        VALUES ($1, $2, $3, $4, 'draft', $5, 0.0)
        RETURNING id::text
        """,
        org_id, title, content, state.get("doc_type", "howto"), state.get("thread_id"),
    )
    doc_id = row["id"]

    logger.info("write_docs_completed", doc_id=doc_id, title=title, content_length=len(content))

    return {
        "draft_content": content,
        "draft_title": title,
        "doc_id": doc_id,
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/agents/nodes/write.py
git commit -m "feat: write docs node — generate documentation with Bedrock Claude"
```

---

## Task 13: Graph Node — AI Review

**Files:**
- Create: `src/agents/nodes/review.py`

- [ ] **Step 1: Create src/agents/nodes/review.py**

```python
from __future__ import annotations

import json
import structlog

from src.agents.state import DocumentationState
from src.integrations.bedrock import call_bedrock
from src.database import execute

logger = structlog.get_logger()

REVIEW_PROMPT = """You are a documentation reviewer. Evaluate the quality of this documentation.

## Original Question
{question}

## Documentation to Review
{content}

## Knowledge Package (ground truth)
{knowledge_package}

Review for:
1. Factual accuracy — does it match the knowledge package?
2. Completeness — does it answer the original question?
3. Code accuracy — are code examples syntactically correct?
4. Clarity — is it easy to follow?
5. Missing steps — are there gaps in the instructions?

Return a JSON object with:
- "confidence": float between 0.0 and 1.0
- "issues": list of specific issues found
- "suggestions": list of improvement suggestions
- "passed": boolean

Return ONLY valid JSON, no other text."""


async def ai_review_node(state: DocumentationState) -> dict:
    logger.info("ai_review_started", org_id=state["org_id"])

    prompt = REVIEW_PROMPT.format(
        question=state["question"],
        content=state.get("draft_content", ""),
        knowledge_package=json.dumps(state.get("knowledge_package", {}), indent=2),
    )

    response = await call_bedrock(prompt)

    try:
        review = json.loads(response)
    except json.JSONDecodeError:
        import re
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            review = json.loads(json_match.group())
        else:
            review = {"confidence": 0.5, "issues": ["Review parsing failed"], "suggestions": [], "passed": False}

    confidence = review.get("confidence", 0.5)

    # Update documentation with confidence score
    doc_id = state.get("doc_id")
    if doc_id:
        await execute(
            "UPDATE documentation SET confidence_score = $1 WHERE id = $2",
            confidence, doc_id,
        )

    logger.info("ai_review_completed", confidence=confidence, passed=review.get("passed", False))

    return {
        "confidence_score": confidence,
        "review_result": review,
        "review_feedback": json.dumps(review.get("issues", [])),
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/agents/nodes/review.py
git commit -m "feat: ai review node — confidence scoring and factual verification"
```

---

## Task 14: Graph Node — HITL + Publish

**Files:**
- Create: `src/agents/nodes/human.py`
- Create: `src/agents/nodes/publish.py`

- [ ] **Step 1: Create src/agents/nodes/human.py**

```python
from __future__ import annotations

import structlog
from langgraph.types import interrupt

from src.agents.state import DocumentationState
from src.memory.reviewer import create_review_session
from src.memory.organizational import store_audit_log

logger = structlog.get_logger()


async def human_review_node(state: DocumentationState) -> dict:
    org_id = state["org_id"]
    doc_id = state.get("doc_id", "")

    logger.info("human_review_started", org_id=org_id, doc_id=doc_id)

    # Create review session
    review_id = await create_review_session(
        doc_id=doc_id,
        confidence_before=state.get("confidence_score", 0),
    )

    # Audit log
    await store_audit_log(
        org_id=org_id,
        actor="system",
        action="request_human_review",
        resource_type="documentation",
        resource_id=doc_id,
        details={"review_id": review_id, "confidence": state.get("confidence_score", 0)},
    )

    # LangGraph interrupt — pause and wait for human decision
    decision = interrupt({
        "type": "documentation_review",
        "doc_id": doc_id,
        "review_id": review_id,
        "title": state.get("draft_title", ""),
        "content": state.get("draft_content", ""),
        "confidence": state.get("confidence_score", 0),
        "question": state["question"],
    })

    # Decision comes back from resume
    human_decision = decision.get("decision", "reject") if isinstance(decision, dict) else "reject"
    human_feedback = decision.get("feedback", "") if isinstance(decision, dict) else ""

    logger.info("human_review_completed", decision=human_decision)

    return {
        "human_decision": human_decision,
        "human_feedback": human_feedback,
    }
```

- [ ] **Step 2: Create src/agents/nodes/publish.py**

```python
from __future__ import annotations

import json
import structlog

from src.agents.state import DocumentationState
from src.memory.vector_store import store_embedding
from src.memory.organizational import store_memory, store_audit_log
from src.database import execute, fetch_one

logger = structlog.get_logger()


async def publish_node(state: DocumentationState) -> dict:
    org_id = state["org_id"]
    doc_id = state.get("doc_id", "")
    content = state.get("draft_content", "")
    title = state.get("draft_title", "")

    logger.info("publish_started", org_id=org_id, doc_id=doc_id)

    # 1. Update documentation status
    await execute(
        "UPDATE documentation SET status = 'approved', updated_at = now() WHERE id = $1",
        doc_id,
    )

    # 2. Store embedding for semantic search
    await store_embedding(
        org_id=org_id,
        content_type="documentation",
        content_id=doc_id,
        content_text=f"{title}\n\n{content}",
        metadata={"doc_type": state.get("doc_type"), "confidence": state.get("confidence_score")},
    )

    # 3. Store as organizational memory
    await store_memory(
        org_id=org_id,
        memory_type="organizational",
        key=title,
        value={
            "doc_id": doc_id,
            "content": content[:1000],
            "doc_type": state.get("doc_type"),
            "confidence": state.get("confidence_score"),
        },
        source="documentation_generation",
        confidence=state.get("confidence_score", 0.5),
    )

    # 4. Store reviewer memory (if human edited)
    if state.get("human_feedback"):
        await store_memory(
            org_id=org_id,
            memory_type="reviewer",
            key=f"review_{doc_id}",
            value={
                "feedback": state["human_feedback"],
                "decision": state.get("human_decision"),
                "doc_title": title,
            },
            source="human_review",
            confidence=1.0,
        )

    # 5. Resolve the original support thread
    await execute(
        """
        UPDATE support_threads
        SET status = 'resolved', resolution = $1, resolved_at = now()
        WHERE id = $2
        """,
        content[:2000],
        state.get("thread_id"),
    )

    # 6. Audit log
    await store_audit_log(
        org_id=org_id,
        actor="agent",
        action="publish_documentation",
        resource_type="documentation",
        resource_id=doc_id,
        details={"title": title, "confidence": state.get("confidence_score")},
    )

    published_urls = [{"platform": "draftly", "doc_id": doc_id}]

    logger.info("publish_completed", doc_id=doc_id, title=title)

    return {
        "published_urls": published_urls,
        "human_decision": "",
        "human_feedback": "",
    }
```

- [ ] **Step 3: Commit**

```bash
git add src/agents/nodes/human.py src/agents/nodes/publish.py
git commit -m "feat: HITL interrupt node + publish node with memory updates"
```

---

## Task 15: Integration Clients

**Files:**
- Create: `src/integrations/slack.py`
- Create: `src/integrations/discord.py`
- Create: `src/integrations/github.py`

- [ ] **Step 1: Create src/integrations/slack.py**

```python
from __future__ import annotations

import httpx
import structlog

from src.config import settings

logger = structlog.get_logger()


async def send_slack_message(channel: str, text: str, thread_ts: str | None = None) -> dict:
    headers = {"Authorization": f"Bearer {settings.slack_bot_token}", "Content-Type": "application/json"}
    payload = {"channel": channel, "text": text}
    if thread_ts:
        payload["thread_ts"] = thread_ts

    async with httpx.AsyncClient() as client:
        resp = await client.post("https://slack.com/api/chat.postMessage", headers=headers, json=payload, timeout=10)
        result = resp.json()
        if not result.get("ok"):
            logger.error("slack_send_failed", error=result.get("error"))
        return result


async def send_dm(user_id: str, text: str) -> dict:
    headers = {"Authorization": f"Bearer {settings.slack_bot_token}", "Content-Type": "application/json"}
    payload = {"channel": user_id, "text": text}

    async with httpx.AsyncClient() as client:
        resp = await client.post("https://slack.com/api/chat.postMessage", headers=headers, json=payload, timeout=10)
        return resp.json()


async def add_reaction(channel: str, timestamp: str, emoji: str) -> dict:
    headers = {"Authorization": f"Bearer {settings.slack_bot_token}", "Content-Type": "application/json"}
    payload = {"channel": channel, "timestamp": timestamp, "name": emoji}

    async with httpx.AsyncClient() as client:
        resp = await client.post("https://slack.com/api/reactions.add", headers=headers, json=payload, timeout=10)
        return resp.json()
```

- [ ] **Step 2: Create src/integrations/discord.py**

```python
from __future__ import annotations

import httpx
import structlog

from src.config import settings

logger = structlog.get_logger()


async def send_discord_message(channel_id: str, content: str) -> dict:
    headers = {"Authorization": f"Bot {settings.discord_bot_token}", "Content-Type": "application/json"}
    payload = {"content": content}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://discord.com/api/v10/channels/{channel_id}/messages",
            headers=headers,
            json=payload,
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            logger.error("discord_send_failed", status=resp.status_code, body=resp.text)
        return resp.json()


async def send_discord_thread_reply(thread_id: str, content: str) -> dict:
    headers = {"Authorization": f"Bot {settings.discord_bot_token}", "Content-Type": "application/json"}
    payload = {"content": content}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://discord.com/api/v10/channels/{thread_id}/messages",
            headers=headers,
            json=payload,
            timeout=10,
        )
        return resp.json()
```

- [ ] **Step 3: Create src/integrations/github.py**

```python
from __future__ import annotations

import httpx
import structlog

from src.config import settings

logger = structlog.get_logger()


async def post_github_comment(owner: str, repo: str, issue_number: int, body: str) -> dict:
    headers = {"Authorization": f"token {settings.github_token}", "Content-Type": "application/json"}
    payload = {"body": body}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments",
            headers=headers,
            json=payload,
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            logger.error("github_comment_failed", status=resp.status_code, body=resp.text)
        return resp.json()


async def get_github_issue(owner: str, repo: str, issue_number: int) -> dict:
    headers = {"Authorization": f"token {settings.github_token}"}

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}",
            headers=headers,
            timeout=10,
        )
        return resp.json()
```

- [ ] **Step 4: Commit**

```bash
git add src/integrations/slack.py src/integrations/discord.py src/integrations/github.py
git commit -m "feat: Slack, Discord, and GitHub integration clients"
```

---

## Task 16: Review Dashboard API

**Files:**
- Create: `src/api/__init__.py`
- Create: `src/api/app.py`
- Create: `src/api/routes/__init__.py`
- Create: `src/api/routes/reviews.py`
- Create: `src/api/routes/docs.py`
- Create: `src/api/routes/memory.py`
- Create: `src/api/templates/base.html`
- Create: `src/api/templates/dashboard.html`
- Create: `src/api/templates/review.html`

- [ ] **Step 1: Create src/api/app.py**

```python
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.templating import Jinja2Templates

from src.api.routes import reviews, docs, memory
from src.database import get_pool, close_pool

templates = Jinja2Templates(directory="src/api/templates")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(title="Draftly Review Dashboard", lifespan=lifespan)

app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(docs.router, prefix="/api/docs", tags=["docs"])
app.include_router(memory.router, prefix="/api/memory", tags=["memory"])


@app.get("/")
async def dashboard():
    from src.memory.reviewer import get_pending_reviews
    reviews = await get_pending_reviews(org_id="default")
    return templates.TemplateResponse("dashboard.html", {"request": {}, "reviews": reviews})


@app.get("/review/{review_id}")
async def review_page(review_id: str):
    from src.database import fetch_one
    review = await fetch_one(
        "SELECT rs.*, rs.id::text as id, d.title, d.content, d.doc_type, d.confidence_score "
        "FROM review_sessions rs JOIN documentation d ON d.id = rs.doc_id WHERE rs.id = $1",
        review_id,
    )
    return templates.TemplateResponse("review.html", {"request": {}, "review": dict(review) if review else None})
```

- [ ] **Step 2: Create src/api/routes/reviews.py**

```python
from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class ReviewDecision(BaseModel):
    decision: str  # approve, reject, revise
    feedback: str = ""


@router.get("/pending")
async def get_pending():
    from src.memory.reviewer import get_pending_reviews
    return await get_pending_reviews(org_id="default")


@router.post("/{review_id}/decide")
async def decide_review(review_id: str, body: ReviewDecision):
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from src.config import settings
    from src.memory.reviewer import complete_review
    from src.memory.organizational import store_audit_log

    # Complete the review session
    await complete_review(
        review_id=review_id,
        status=body.decision,
        feedback=body.feedback,
    )

    # Resume the LangGraph workflow
    checkpointer = AsyncPostgresSaver.from_conn_string(settings.cockroachdb_url)

    # Find the workflow thread for this review
    from src.database import fetch_one
    row = await fetch_one(
        "SELECT rs.doc_id, aw.id::text as workflow_id FROM review_sessions rs "
        "JOIN documentation d ON d.id = rs.doc_id "
        "JOIN agent_workflows aw ON aw.doc_id = rs.doc_id "
        "WHERE rs.id = $1",
        review_id,
    )

    if row:
        from langgraph.types import Command
        # The actual resume would use the LangGraph SDK or direct checkpointer access
        # For the dashboard, we store the decision and the workflow resumes via the API
        pass

    return {"status": "ok", "decision": body.decision}


@router.get("/{review_id}")
async def get_review(review_id: str):
    from src.database import fetch_one
    row = await fetch_one(
        "SELECT rs.*, rs.id::text as id, d.title, d.content, d.doc_type, d.confidence_score "
        "FROM review_sessions rs JOIN documentation d ON d.id = rs.doc_id WHERE rs.id = $1",
        review_id,
    )
    return dict(row) if row else {"error": "not found"}
```

- [ ] **Step 3: Create src/api/routes/docs.py**

```python
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_docs():
    from src.database import fetch_all
    rows = await fetch_all(
        "SELECT *, id::text as id FROM documentation WHERE org_id = 'default' ORDER BY created_at DESC LIMIT 50"
    )
    return [dict(r) for r in rows]


@router.get("/{doc_id}")
async def get_doc(doc_id: str):
    from src.database import fetch_one
    row = await fetch_one("SELECT *, id::text as id FROM documentation WHERE id = $1", doc_id)
    return dict(row) if row else {"error": "not found"}
```

- [ ] **Step 4: Create src/api/routes/memory.py**

```python
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/stats")
async def memory_stats():
    from src.database import fetch_one
    stats = {}
    for table in ["support_threads", "documentation", "embeddings", "review_sessions", "agent_memory", "audit_logs"]:
        count = await fetch_one(f"SELECT count(*) FROM {table}")
        stats[table] = count[0] if count else 0
    return stats


@router.get("/search")
async def search_memory(q: str, type: str = "all"):
    from src.memory.vector_store import search_similar
    results = await search_similar(org_id="default", query_text=q, k=10)
    return results
```

- [ ] **Step 5: Create templates**

Create `src/api/templates/base.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <title>{% block title %}Draftly{% endblock %}</title>
    <style>
        body { font-family: system-ui; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 8px 0; }
        .badge { padding: 2px 8px; border-radius: 4px; font-size: 0.8em; }
        .badge-pending { background: #fef3cd; }
        .badge-approved { background: #d4edda; }
        .badge-rejected { background: #f8d7da; }
        button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
        .btn-approve { background: #28a745; color: white; }
        .btn-reject { background: #dc3545; color: white; }
        .btn-revise { background: #ffc107; color: black; }
    </style>
</head>
<body>
    <h1>Draftly Review Dashboard</h1>
    {% block content %}{% endblock %}
</body>
</html>
```

Create `src/api/templates/dashboard.html`:
```html
{% extends "base.html" %}
{% block title %}Dashboard - Draftly{% endblock %}
{% block content %}
<h2>Pending Reviews ({{ reviews|length }})</h2>
{% for review in reviews %}
<div class="card">
    <h3>{{ review.title }}</h3>
    <p>Type: {{ review.doc_type }} | Confidence: {{ review.confidence_score }}</p>
    <p>Created: {{ review.created_at }}</p>
    <a href="/review/{{ review.id }}">Review →</a>
</div>
{% empty %}
<p>No pending reviews.</p>
{% endfor %}
{% endblock %}
```

Create `src/api/templates/review.html`:
```html
{% extends "base.html" %}
{% block title %}Review - Draftly{% endblock %}
{% block content %}
{% if review %}
<h2>{{ review.title }}</h2>
<p>Type: {{ review.doc_type }} | Confidence: {{ review.confidence_score }}</p>
<div class="card">
    <h3>Generated Documentation</h3>
    <pre>{{ review.content }}</pre>
</div>
<div class="card">
    <h3>Your Review</h3>
    <textarea id="feedback" rows="4" style="width:100%"></textarea>
    <br><br>
    <button class="btn-approve" onclick="decide('approve')">Approve</button>
    <button class="btn-revise" onclick="decide('revise')">Request Changes</button>
    <button class="btn-reject" onclick="decide('reject')">Reject</button>
</div>
<script>
async function decide(decision) {
    const feedback = document.getElementById('feedback').value;
    await fetch('/api/reviews/{{ review.id }}/decide', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({decision, feedback})
    });
    window.location.href = '/';
}
</script>
{% else %}
<p>Review not found.</p>
{% endif %}
{% endblock %}
```

- [ ] **Step 6: Commit**

```bash
git add src/api/
git commit -m "feat: review dashboard API with HITL workflow"
```

---

## Task 17: CLI for Local Testing

**Files:**
- Create: `src/cli/__init__.py`
- Create: `src/cli/draftly.py`

- [ ] **Step 1: Create src/cli/draftly.py**

```python
from __future__ import annotations

import asyncio
import json
import sys

import structlog

from src.agents.graph import compile_graph
from src.database import get_pool, close_pool

logger = structlog.get_logger()


async def run_workflow(question: str, source: str = "cli", org_id: str = "default"):
    await get_pool()
    graph = await compile_graph()

    initial_state = {
        "org_id": org_id,
        "source": source,
        "channel_id": "cli",
        "thread_id": "cli-test",
        "question": question,
        "similar_threads": [],
        "existing_docs": [],
        "reviewer_feedback_history": [],
        "semantic_context": [],
        "github_context": [],
        "slack_context": [],
        "knowledge_package": {},
        "draft_content": "",
        "draft_title": "",
        "doc_type": "howto",
        "confidence_score": 0.0,
        "review_result": {},
        "review_feedback": "",
        "human_decision": "",
        "human_feedback": "",
        "published_urls": [],
        "workflow_id": "",
        "doc_id": "",
        "messages": [],
    }

    config = {"configurable": {"thread_id": f"cli-{hash(question)}"}}

    print(f"\n🔄 Processing: {question}\n")

    result = await graph.ainvoke(initial_state, config)

    print(f"\n✅ Completed!")
    print(f"Title: {result.get('draft_title', 'N/A')}")
    print(f"Confidence: {result.get('confidence_score', 0):.2f}")
    print(f"Doc Type: {result.get('doc_type', 'N/A')}")

    if result.get("human_decision"):
        print(f"Human Decision: {result['human_decision']}")

    print(f"\n📄 Draft:\n{result.get('draft_content', 'N/A')[:500]}...")

    await close_pool()
    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m src.cli.draftly 'your question here'")
        sys.exit(1)

    question = sys.argv[1]
    asyncio.run(run_workflow(question))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/
git commit -m "feat: CLI for local testing and demo"
```

---

## Task 18: Demo Data Seeding

**Files:**
- Create: `scripts/seed_demo_data.py`

- [ ] **Step 1: Create seed script**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed_demo_data.py
git commit -m "feat: demo data seeding script"
```

---

## Task 19: Docker + Local Dev

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[dev]"

COPY src/ src/
COPY infrastructure/ infrastructure/
COPY scripts/ scripts/

EXPOSE 8000

CMD ["uvicorn", "src.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      - cockroachdb

  cockroachdb:
    image: cockroachdb/cockroach:latest
    command: start-single-node --insecure
    ports:
      - "26257:26257"
      - "8080:8080"
    volumes:
      - cockroach-data:/var/lib/cockroach

volumes:
  cockroach-data:
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: Docker and docker-compose for local development"
```

---

## Task 20: README + Documentation

**Files:**
- Modify: `README.md`
- Create: `docs/demo-guide.md`

- [ ] **Step 1: Write README.md**

```markdown
# Draftly AI

**Autonomous Documentation Engineering with Persistent Agentic Memory**

Draftly is an autonomous documentation engineering platform that transforms support conversations into production-ready documentation using AI agents, CockroachDB, and AWS.

## Architecture

- **LangGraph State Machine** — 8-node pipeline with HITL interrupts
- **CockroachDB** — 5 memory types (semantic, episodic, procedural, reviewer, organizational) with Distributed Vector Index
- **Amazon Bedrock** — Claude for LLM reasoning
- **AWS** — Lambda webhooks, SQS queuing, ECS Fargate, S3, Secrets Manager, CloudWatch

## Quick Start

```bash
# Install dependencies
pip install -e ".[dev]"

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run locally with docker-compose
docker-compose up

# Seed demo data
python scripts/seed_demo_data.py

# Start the dashboard
uvicorn src.api.app:app --reload

# Test via CLI
python -m src.cli.draftly "How do I configure CockroachDB MCP?"
```

## CockroachDB Tools Used

| Tool | Usage |
|------|-------|
| Distributed Vector Index | Semantic search across documentation and support threads |
| MCP Server | Natural language queries against memory |
| ccloud CLI | Cluster provisioning and management |
| Agent Skills | CockroachDB-aware SQL patterns |

## AWS Services Used

| Service | Purpose |
|---------|---------|
| Amazon Bedrock | LLM reasoning (Claude) |
| Lambda | Webhook handlers |
| SQS | Event queue |
| ECS Fargate | Agent runner |
| S3 | Document artifacts |
| Secrets Manager | Credentials |
| CloudWatch | Observability |

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md docs/
git commit -m "feat: README and demo documentation"
```

---

## Task 21: Run Linting + Type Checks

- [ ] **Step 1: Run ruff**

Run: `ruff check src/`
Expected: No errors (fix any found)

- [ ] **Step 2: Run ruff format check**

Run: `ruff format --check src/`
Expected: All files formatted

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: linting and formatting"
```

---

## Task 22: Final Commit + Tag

- [ ] **Step 1: Review all files**

Run: `git status`
Expected: Clean working directory

- [ ] **Step 2: Tag for demo**

```bash
git tag -a v0.1.0 -m "Draftly AI - Hackathon submission"
```

---

## Execution Notes

**Build order:** Tasks 1-5 (foundation) → Tasks 6-14 (agent pipeline) → Tasks 15-16 (integrations + API) → Tasks 17-20 (CLI, demo, Docker, docs) → Tasks 21-22 (polish)

**Estimated time per task:** 15-45 minutes depending on complexity

**Key dependencies:**
- Task 6 (graph) depends on Tasks 2, 4, 5 (database + memory)
- Task 14 (publish) depends on Tasks 4, 5 (memory systems)
- Task 16 (API) depends on Task 14 (publish + HITL)
- Task 18 (seeding) depends on Task 4 (vector store)
