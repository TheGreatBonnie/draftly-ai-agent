# Draftly AI

**Autonomous Documentation Engineering with Persistent Agentic Memory**

Draftly is an autonomous documentation engineering platform that transforms support conversations into production-ready documentation using AI agents, CockroachDB, and AWS.

## Architecture

- **LangGraph State Machine** — 8-node pipeline with conditional routing, rubric-based evaluation, and HITL interrupts
- **CockroachDB** — 13 tables with distributed vector index (C-SPANN) for semantic search across 5 memory types
- **Requesty** — OpenAI-compatible API for all LLM reasoning (per-stage models for research, review, rubric grading)
- **React 19 SPA** — TypeScript, Vite, TailwindCSS, Clerk auth for the review dashboard
- **AWS** — ECS Fargate, ECR, ALB, CloudWatch (via Terraform)

## Integrations

| Platform | Direction | Usage                                                              |
| -------- | --------- | ------------------------------------------------------------------ |
| Slack    | In + Out  | Thread ingestion, Block Kit interactive review cards               |
| Discord  | In + Out  | Thread ingestion, reply on publish                                 |
| GitHub   | In + Out  | App webhooks (issue-triggered pipeline), issue comments on publish |
| CLI      | In        | `python -m src.cli.draftly "question"`                             |
| SendGrid | Out       | Email review notifications with action links                       |
| Clerk    | Auth      | JWT verification, org management, role-based access                |

## Quick Start

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync

# Set up environment
cp .env.example .env
# Edit .env with your credentials (CockroachDB, Requesty, Clerk, etc.)

# Start CockroachDB locally
docker compose up -d cockroachdb

# Initialize the database schema
uv run python scripts/init_db.py

# Seed demo data (optional)
uv run python scripts/seed_demo_data.py

# Start the API + dashboard
uv run uvicorn src.api.app:app --reload

# Test via CLI
uv run python -m src.cli.draftly "How do I configure CockroachDB MCP?"
```

## Frontend

React 19 SPA served by FastAPI from `frontend/dist/`. Routes:

| Route         | Page                                  |
| ------------- | ------------------------------------- |
| `/`           | Landing page                          |
| `/dashboard`  | Pending reviews                       |
| `/review/:id` | Review detail + approve/reject/revise |
| `/reviewers`  | Reviewer management                   |
| `/docs`       | Documentation browser                 |
| `/knowledge`  | Knowledge base (upload, URL import)   |
| `/memory`     | Memory stats + semantic search        |
| `/settings`   | Org settings, GitHub App connection   |

```bash
# Dev mode (proxies /api to backend on :8000)
cd frontend && npm install && npm run dev
```

## Local Development

```bash
# Full stack with CockroachDB
docker compose up

# Backend only (requires external CockroachDB)
uv run uvicorn src.api.app:app --reload

# Run tests
uv run pytest

# Lint
uv run ruff check src/

# Type check
uv run mypy src/
```

## Tunneling for Webhooks

Use **Tailscale Funnel** to expose local services for webhook integrations (Slack, Discord, GitHub, Clerk). Requires a free Tailscale account.

### Install & Setup

```bash
brew install tailscale
# Open Tailscale.app and authenticate, then:
tailscale up
```

### Backend (port 8000)

```bash
tailscale funnel 8000
```

Copy the `https://*.ts.net` URL and update:

- `.env` → `NGROK_URL`
- Slack, Discord, GitHub App, and Clerk webhook endpoints

### Frontend (port 5173)

```bash
tailscale funnel --bg http://localhost:5173
```

This gives you a stable `https://*.ts.net` URL for the Vite dev server.

### Add Vite Host

Add your Tailscale hostname to `frontend/vite.config.ts`:

```ts
allowedHosts: ["your-machine-name.tailXXXXXX.ts.net"];
```

## Project Structure

```
src/
  agents/        # LangGraph pipeline (graph, nodes, skills, tools, rubrics)
  memory/        # 5 memory modules (episodic, procedural, organizational, reviewer, vector)
  integrations/  # Slack, Discord, GitHub, SendGrid, LLM
  api/           # FastAPI app, auth, routes
  security/      # HMAC review tokens
  knowledge/     # URL content fetcher (webpages, PDFs, Google Docs, Notion)
  services/      # Clerk Admin API
  cli/           # CLI entry point
frontend/        # React 19 SPA (TypeScript, Vite, TailwindCSS)
infrastructure/  # CockroachDB schema + Terraform (AWS ECS Fargate)
scripts/         # DB init, demo data seeding
tests/           # Pytest suite
```

## License

MIT
