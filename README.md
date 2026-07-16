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
