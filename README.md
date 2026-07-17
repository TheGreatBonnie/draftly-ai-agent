# Draftly AI

**Autonomous Documentation Engineering with Persistent Agentic Memory**

Draftly is an autonomous documentation engineering platform that transforms support conversations into production-ready documentation using AI agents, CockroachDB, and AWS.

## Architecture

- **LangGraph State Machine** — 8-node pipeline with HITL interrupts
- **CockroachDB** — 5 memory types (semantic, episodic, procedural, reviewer, organizational) with Distributed Vector Index
- **Requesty** — OpenAI-compatible API for LLM reasoning and embeddings
- **AWS** — Lambda webhooks, SQS queuing, ECS Fargate, S3, Secrets Manager, CloudWatch

## Quick Start

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync

# Set up environment
cp .env.example .env
# Edit .env with your credentials (Requesty API key, CockroachDB URL, etc.)

# Run locally with docker-compose
docker-compose up

# Seed demo data (with CockroachDB running)
uv run python scripts/seed_demo_data.py

# Start the dashboard
uv run uvicorn src.api.app:app --reload

# Test via CLI
uv run python -m src.cli.draftly "How do I configure CockroachDB MCP?"
```

## CockroachDB Tools Used

| Tool | Usage |
|------|-------|
| Distributed Vector Index | Semantic search across documentation and support threads |
| MCP Server | Natural language queries against memory |
| ccloud CLI | Cluster provisioning and management |
| Agent Skills | CockroachDB-aware SQL patterns |

## License

MIT
