# Draftly AI — Design Specification

## Overview

Draftly is an autonomous documentation engineering platform powered by AI agents that continuously transforms support conversations into accurate, production-ready documentation. Built with LangGraph, CockroachDB, and AWS, it uses persistent agentic memory to learn from every interaction and improve over time.

**Solo developer. 4+ weeks. Hackathon submission targeting all 5 judging criteria.**

---

## Architecture Approach

**LangGraph State Machine** — a single `StateGraph` with nodes for each pipeline phase. CockroachDB serves as both the LangGraph checkpointer (persistent workflow state) and the external memory store (vectors, episodic, procedural, reviewer, organizational).

LangGraph interrupts handle HITL natively — no custom pause/resume plumbing.

---

## System Architecture

```
Slack/Discord Bot → Lambda (webhook) → SQS → ECS Fargate (agent runner)
                                                     │
                                              LangGraph StateGraph:
                                              [ingest] → [memory_retrieve] → [research] → [synthesize]
                                              → [write] → [ai_review] → [HITL_INTERRUPT] → [publish]
                                                     │
                                              CockroachDB (checkpointer + memory + vectors)
```

### AWS Services

| Service | Purpose |
|---------|---------|
| Amazon Bedrock (Claude) | LLM reasoning for all agent nodes |
| Lambda | Webhook handlers for Slack, Discord, GitHub |
| SQS + DLQ | Event queue with retry and dead-letter support |
| ECS Fargate | Agent runner + review dashboard |
| S3 | Published documentation artifacts |
| Secrets Manager | All tokens and connection strings |
| CloudWatch | Logs, metrics, alarms |

### CockroachDB Tools

| Tool | Usage |
|------|-------|
| Distributed Vector Index | Semantic search across documentation and support threads |
| MCP Server | Natural language queries against memory from agents |
| ccloud CLI | Cluster provisioning, backups, scaling |
| Agent Skills | CockroachDB-aware SQL patterns and schema design |

---

## Database Schema (8 tables)

### 1. organizations

Multi-tenant foundation.

```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name STRING NOT NULL,
    slack_workspace_id STRING,
    discord_guild_id STRING,
    github_org STRING,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2. support_threads (Episodic Memory)

Every support conversation.

```sql
CREATE TABLE support_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    source STRING NOT NULL,
    channel_id STRING NOT NULL,
    thread_id STRING NOT NULL,
    title STRING,
    question_summary STRING,
    resolution TEXT,
    status STRING DEFAULT 'open',
    participants JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
```

### 3. documentation (Versioned Output)

```sql
CREATE TABLE documentation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    title STRING NOT NULL,
    content TEXT NOT NULL,
    doc_type STRING NOT NULL,
    version INT DEFAULT 1,
    status STRING DEFAULT 'draft',
    source_thread_id UUID REFERENCES support_threads(id),
    confidence_score FLOAT,
    published_to JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. embeddings (Semantic Memory)

```sql
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    content_type STRING NOT NULL,
    content_id UUID NOT NULL,
    content_text TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON embeddings
    USING vector (embedding vector_cosine_ops)
    WITH (lists = 100);
```

### 5. review_sessions (Reviewer Memory)

```sql
CREATE TABLE review_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID REFERENCES documentation(id),
    reviewer_id UUID,
    status STRING DEFAULT 'pending',
    reviewer_feedback TEXT,
    edits_made JSONB,
    confidence_before FLOAT,
    confidence_after FLOAT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);
```

### 6. agent_workflows (Procedural Memory)

```sql
CREATE TABLE agent_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    thread_id UUID REFERENCES support_threads(id),
    doc_id UUID REFERENCES documentation(id),
    graph_state JSONB NOT NULL,
    current_node STRING,
    status STRING DEFAULT 'running',
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 7. agent_memory (Organizational Knowledge)

```sql
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    memory_type STRING NOT NULL,
    key STRING NOT NULL,
    value JSONB NOT NULL,
    source TEXT,
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_accessed TIMESTAMPTZ
);
```

### 8. audit_logs

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    actor STRING NOT NULL,
    actor_id STRING,
    action STRING NOT NULL,
    resource_type STRING,
    resource_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## LangGraph Agent Architecture

### State Schema

```python
from typing import TypedDict, Annotated, Literal
from langgraph.graph.message import add_messages

class DocumentationState(TypedDict):
    # Input
    org_id: str
    source: Literal["slack", "discord", "github"]
    thread_id: str
    question: str

    # Memory retrieval
    similar_threads: list[dict]
    existing_docs: list[dict]
    reviewer_feedback: list[dict]
    semantic_context: list[dict]

    # Research
    github_context: list[dict]
    slack_context: list[dict]

    # Synthesis
    knowledge_package: dict

    # Output
    draft_content: str
    doc_type: str
    confidence_score: float

    # Review
    review_result: dict
    review_feedback: str

    # HITL
    human_decision: Literal["approve", "reject", "revise"]
    human_feedback: str

    # Final
    published_urls: list[dict]

    # Audit
    workflow_id: str
    messages: Annotated[list, add_messages]
```

### 8 Graph Nodes

1. **ingest** — Parse incoming message, create support_thread record, initialize workflow state
2. **memory_retrieve** — Vector search via Distributed Vector Index, SQL query for existing docs, reviewer feedback history, MCP Server natural language query
3. **research** — GitHub Agent (search issues/PRs) + Slack Agent (search thread history) in parallel via asyncio.gather()
4. **synthesize** — Merge all context into knowledge_package, resolve conflicts, deduplicate, identify knowledge gaps
5. **write_docs** — Generate documentation using Bedrock Claude (title, intro, steps, examples, FAQ)
6. **ai_review** — Factual consistency check, code example verification, confidence scoring (0.0-1.0); if < 0.7 route back to research
7. **human_review (INTERRUPT)** — LangGraph pauses execution, state persisted to CockroachDB checkpointer, notification sent, resumes when reviewer acts
8. **publish** — Update doc status, reply to original Slack/Discord thread, store artifact in S3, update all memory tables

### Graph Edges

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

def build_graph():
    graph = StateGraph(DocumentationState)

    graph.add_node("ingest", ingest_node)
    graph.add_node("memory_retrieve", memory_retrieve_node)
    graph.add_node("research", research_node)
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("write_docs", write_docs_node)
    graph.add_node("ai_review", ai_review_node)
    graph.add_node("human_review", human_review_node)
    graph.add_node("publish", publish_node)

    graph.set_entry_point("ingest")
    graph.add_edge("ingest", "memory_retrieve")
    graph.add_edge("memory_retrieve", "research")
    graph.add_edge("research", "synthesize")
    graph.add_edge("synthesize", "write_docs")
    graph.add_edge("write_docs", "ai_review")

    graph.add_conditional_edges(
        "ai_review",
        lambda state: "human_review" if state["confidence_score"] >= 0.7 else "research",
        {"human_review": "human_review", "research": "research"}
    )

    graph.add_conditional_edges(
        "human_review",
        lambda state: {
            "approve": "publish",
            "reject": "END",
            "revise": "write_docs"
        }[state["human_decision"]],
    )

    graph.add_edge("publish", END)

    checkpointer = AsyncPostgresSaver.from_conn_string(COCKROACHDB_URL)
    return graph.compile(checkpointer=checkpointer)
```

### Subagent Design

Each "subagent" is a helper function called within a graph node, not a separate agent instance. This avoids overhead while keeping responsibilities clean.

- **Memory Agent** — queries CockroachDB via vector search + SQL + MCP Server
- **GitHub Agent** — uses GitHub API via LangChain tools
- **Slack Agent** — uses Slack API via LangChain tools
- **Research Agent** — orchestrates GitHub + Slack agents in parallel
- **Writer Agent** — generates documentation with Bedrock Claude
- **Reviewer Agent** — scores confidence, checks factual consistency

---

## Memory System

### 5 Memory Layers

| Layer | Table | Purpose |
|-------|-------|---------|
| Semantic | `embeddings` | Vector embeddings for similarity search |
| Episodic | `support_threads` | Historical support conversations |
| Procedural | `agent_workflows` | Workflow execution state |
| Reviewer | `review_sessions` + `agent_memory` | Human feedback and learning |
| Organizational | `agent_memory` | Best practices, decisions, known issues |

### Write Path (after every workflow)

1. Store embedding for new documentation in `embeddings`
2. Store workflow state as procedural memory in `agent_memory`
3. If human reviewed, store reviewer learning in `agent_memory`

### Read Path (during memory retrieval)

1. Semantic search via Distributed Vector Index on `embeddings`
2. Episodic search via full-text on `support_threads`
3. Organizational memory via keyword match on `agent_memory`
4. Reviewer memory via recency + confidence on `agent_memory`

---

## HITL Workflow

1. AI generates documentation, confidence score computed
2. If confidence >= 0.7 → LangGraph `interrupt_before["human_review"]`
3. State saved to CockroachDB checkpointer
4. Notification sent (Slack DM + dashboard)
5. Reviewer acts via:
   - Slack: `/approve`, `/reject <feedback>`, `/revise <instructions>`
   - Web dashboard: approve/reject/edit inline
6. LangGraph resumes from CockroachDB state
7. Decision routes: approve → publish, reject → END (feedback stored), revise → write_docs (with feedback context)
8. Review session stored as reviewer memory for future docs

### Review Dashboard

FastAPI + Jinja2 templates:
- List of pending reviews with confidence scores
- Side-by-side view: original thread + generated doc
- Approve / Reject / Request Changes buttons
- Inline editing capability

---

## Project Structure

```
draftly/
├── README.md
├── pyproject.toml
├── .env.example
├── docker-compose.yml
├── Dockerfile
│
├── infrastructure/
│   ├── cdk/
│   │   ├── lib/
│   │   │   ├── vpc-stack.ts
│   │   │   ├── ecs-stack.ts
│   │   │   ├── lambda-stack.ts
│   │   │   ├── sqs-stack.ts
│   │   │   ├── s3-stack.ts
│   │   │   ├── secrets-stack.ts
│   │   │   └── monitoring-stack.ts
│   │   └── bin/
│   │       └── app.ts
│   └── cockroachdb/
│       ├── schema.sql
│       ├── seed.sql
│       └── migrations/
│
├── src/
│   ├── __init__.py
│   ├── config.py
│   ├── database.py
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── graph.py
│   │   ├── state.py
│   │   ├── nodes/
│   │   │   ├── __init__.py
│   │   │   ├── ingest.py
│   │   │   ├── memory.py
│   │   │   ├── research.py
│   │   │   ├── synthesize.py
│   │   │   ├── write.py
│   │   │   ├── review.py
│   │   │   ├── human.py
│   │   │   └── publish.py
│   │   └── tools/
│   │       ├── __init__.py
│   │       ├── memory_tools.py
│   │       ├── github_tools.py
│   │       ├── slack_tools.py
│   │       └── search_tools.py
│   │
│   ├── memory/
│   │   ├── __init__.py
│   │   ├── vector_store.py
│   │   ├── episodic.py
│   │   ├── procedural.py
│   │   ├── reviewer.py
│   │   └── organizational.py
│   │
│   ├── integrations/
│   │   ├── __init__.py
│   │   ├── bedrock.py
│   │   ├── slack.py
│   │   ├── discord.py
│   │   └── github.py
│   │
│   ├── webhooks/
│   │   ├── __init__.py
│   │   ├── slack.py
│   │   ├── discord.py
│   │   └── github.py
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── app.py
│   │   ├── routes/
│   │   │   ├── reviews.py
│   │   │   ├── docs.py
│   │   │   └── memory.py
│   │   └── templates/
│   │       ├── base.html
│   │       ├── dashboard.html
│   │       └── review.html
│   │
│   └── cli/
│       ├── __init__.py
│       └── draftly.py
│
├── tests/
│   ├── __init__.py
│   ├── test_graph.py
│   ├── test_memory.py
│   ├── test_nodes.py
│   └── fixtures/
│
├── scripts/
│   ├── setup_cockroachdb.sh
│   ├── seed_demo_data.py
│   └── deploy.sh
│
└── docs/
    ├── architecture.md
    ├── api.md
    └── demo-guide.md
```

---

## Demo Strategy

### 3-Minute Video Arc

1. **Hook** (0:00-0:20) — Slack question arrives, Draftly reacts with eyes emoji
2. **Agent at work** (0:20-0:50) — CockroachDB dashboard showing memory tables, vector search visual, GitHub research
3. **Documentation generation** (0:50-1:20) — Complete how-to guide generated, confidence 0.85, AI review passes
4. **HITL** (1:20-1:50) — Reviewer gets Slack notification, opens dashboard, reads draft, makes edit, approves
5. **Publishing** (1:50-2:20) — Docs published to site, Draftly replies to Slack thread, replies in Discord
6. **Memory loop** (2:20-2:50) — Same question asked again, Draftly answers instantly from memory, CockroachDB dashboard shows memory grew
7. **Close** (2:50-3:00) — "Draftly — Every conversation makes the system smarter"

### Live Demo Setup

- Slack workspace with Draftly bot installed
- Pre-seeded CockroachDB with ~200 historical support threads and embeddings
- Review dashboard running on ECS
- 3-4 demo scenarios (howto, FAQ, troubleshooting)

---

## Production Features

| Feature | Implementation |
|---------|---------------|
| Multi-tenant | `org_id` foreign key on all tables |
| Audit logging | `audit_logs` table, every agent action recorded |
| Retry logic | SQS DLQ + LangGraph retry policies |
| Observability | CloudWatch logs + custom metrics |
| Secrets management | AWS Secrets Manager for all credentials |
| Document versioning | `version` column on `documentation`, previous versions preserved |
| Confidence scoring | AI review node computes 0.0-1.0 score, gates HITL |
| Error handling | Graph nodes catch exceptions, store errors, route to recovery |

---

## Judging Criteria Alignment

| Criterion | Implementation |
|-----------|---------------|
| **Agentic Memory Design** | 5 memory types in CockroachDB, Distributed Vector Index for semantic search, MCP Server for natural language memory queries, checkpointer for workflow persistence |
| **Technical Implementation** | All 4 CockroachDB tools used, LangGraph state machine with interrupts, Bedrock Claude integration, AWS CDK infrastructure |
| **Real-World Impact** | Live Slack/Discord bots, real support conversation processing, documentation auto-generation and publishing |
| **Production Readiness** | ECS Fargate deployment, secrets management, audit logging, CloudWatch observability, SQS retry/dead-letter, multi-tenant design |
| **Creativity & Originality** | AI learns from human edits, memory improves over time, confidence-based escalation, proactive documentation from support conversations |
