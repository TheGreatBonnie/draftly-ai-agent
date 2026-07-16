# Demo Guide

Step-by-step walkthrough for demonstrating Draftly AI.

## Prerequisites

- Python 3.11+
- Docker and Docker Compose
- CockroachDB connection (local or cloud)
- AWS credentials configured

## 1. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your CockroachDB connection string, AWS credentials, and Bedrock model ID.

## 2. Start Services

```bash
docker-compose up
```

This starts the API server, agent runner, and local CockroachDB instance.

## 3. Seed Demo Data

```bash
python scripts/seed_demo_data.py
```

Populates CockroachDB with:
- 1 demo organization (Acme Corp)
- 8 support threads from Slack, Discord, and GitHub
- Vector embeddings for semantic search
- Sample documentation entries

## 4. Launch the Dashboard

```bash
uvicorn src.api.app:app --reload
```

Open http://localhost:8000 in your browser.

## 5. Submit a Support Request

### Via CLI

```bash
python -m src.cli.draftly "How do I configure CockroachDB MCP?"
```

### Via API

```bash
curl -X POST http://localhost:8000/api/v1/requests \
  -H "Content-Type: application/json" \
  -d '{"source": "slack", "title": "CockroachDB MCP setup", "question": "How do I configure CockroachDB MCP with Claude Code?"}'
```

## 6. Watch the Pipeline

The LangGraph state machine executes 8 nodes:

1. **Ingest** — Receives and validates the support request
2. **Memory Retrieval** — Searches CockroachDB vector index for related context
3. **GitHub Research** — Fetches relevant issues and PRs
4. **Slack/Discord Analysis** — Pulls conversation history
5. **Knowledge Synthesis** — Merges findings into coherent context
6. **Documentation Generation** — Produces draft documentation
7. **Review** — Autonomous quality check with reviewer memory
8. **Publish** — Deploys to docs platform and responds to original channel

Each node stores results in CockroachDB memory tables for future retrieval.

## 7. Review Documentation

Check the dashboard for generated documentation. The HITL interrupt pauses before publication, allowing a technical reviewer to approve or request changes.

Reviewer feedback is stored as **organizational memory** and improves future generations.

## Key Demo Talking Points

- **Persistent memory**: Every interaction strengthens future responses
- **5 memory types**: Semantic (embeddings), episodic (history), procedural (workflow), reviewer (feedback), organizational (approved docs)
- **HITL workflow**: Human approval before publication ensures quality
- **Multi-source ingestion**: Slack, Discord, GitHub — all unified
- **CockroachDB as the brain**: Vector search, relational queries, and transactional consistency in one system
