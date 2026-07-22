# Features

Draftly is an autonomous documentation engineering platform that transforms support conversations into production-ready documentation using AI agents, CockroachDB, and AWS.

**Status key:** ✅ Implemented | 🚧 Partial | ❌ Not Implemented

---

## Core Pipeline (✅ All Implemented)

The LangGraph 8-node state machine drives the full documentation lifecycle from ingestion to publication.

| Feature | Description | Location |
|---------|-------------|----------|
| **8-node state machine** | Ingest → Memory → Research → Synthesize → Write → Review → Human → Publish with conditional routing | `src/agents/graph.py` |
| **Ingest node** | Creates support threads, classifies question complexity (simple/moderate/complex), selects documentation type and research skill | `src/agents/nodes/ingest.py` |
| **Memory retrieval** | 4-way parallel retrieval: semantic vector search, episodic (similar threads), organizational (patterns), reviewer feedback | `src/agents/nodes/memory.py` |
| **Research node** | Generates investigation plan (2/4/7 tasks by complexity), executes DuckDuckGo web searches, synthesizes findings via LLM | `src/agents/nodes/research.py` |
| **Synthesize node** | Merges thread + memory + research into structured JSON knowledge package (key_facts, solutions, code_examples, gaps, sources) | `src/agents/nodes/synthesize.py` |
| **Write docs node** | Generates production-ready markdown documentation via LLM, applies confidence scoring, stores draft in DB | `src/agents/nodes/write.py` |
| **AI review (rubric-based)** | LLM-generated review graded against DOCUMENTATION_RUBRIC, up to 3 iterative grading passes, routes based on quality | `src/agents/nodes/review.py`, `src/agents/middleware/rubric.py` |
| **Human-in-the-loop review** | `interrupt()` pauses execution, notifies reviewers via Slack/Discord/Email, resumes via `Command(resume=...)` | `src/agents/nodes/human.py` |
| **Publish node** | Stores chunked embeddings, marks thread resolved, replies to originating platform (GitHub/Slack/Discord) | `src/agents/nodes/publish.py` |
| **Rubric definitions** | 3 rubrics: DOCUMENTATION, RESEARCH, SYNTHESIS — each with grading criteria and confidence extraction | `src/agents/rubrics.py` |
| **State definition** | `DocumentationState` TypedDict with 31 fields tracking full pipeline state | `src/agents/state.py` |

---

## Research Skills (✅ All Implemented)

5 domain-specific research skills with keyword-based selection at ingest time.

| Skill | Keywords | Description |
|-------|----------|-------------|
| `api_question` | api, endpoint, request, response, rest | API integration patterns, endpoint documentation |
| `configuration` | config, setup, install, environment | Configuration guides, environment setup |
| `troubleshooting` | error, bug, issue, fail, crash, debug | Debugging workflows, error resolution |
| `tutorial` | tutorial, guide, how-to, walkthrough | Step-by-step instructional content |
| `conceptual` | concept, architecture, design, explain | Conceptual explanations, architecture docs |

**Location:** `src/agents/skills/__init__.py`, `src/agents/planners/investigation.py`

---

## Memory System (✅ All Implemented)

Multi-layered memory architecture for organizational knowledge persistence.

| Memory Type | Description | Location |
|-------------|-------------|----------|
| **Episodic** | Support thread history and context, full-text search | `src/memory/episodic.py` |
| **Procedural** | Agent workflow states and decisions | `src/memory/procedural.py` |
| **Organizational** | Team knowledge patterns and best practices | `src/memory/organizational.py` |
| **Reviewer** | Human feedback and approval history | `src/memory/reviewer.py` |
| **Semantic** | 3072-dimension vector embeddings with C-SPANN index | `src/memory/vector_store.py` |
| **Chunking** | Document chunking (1000 chars / 200 overlap) for embedding storage | `src/memory/chunking.py` |
| **Reviewer management** | Reviewer CRUD, notification preferences | `src/memory/reviewers.py` |
| **Organizations** | Org management, GitHub installations/workflows | `src/memory/organizations.py` |
| **Users** | Clerk user + org membership management | `src/memory/users.py` |

---

## Integrations (✅ All Implemented)

| Integration | Capabilities | Location |
|-------------|-------------|----------|
| **Slack** | Send messages with Block Kit, DMs, reactions | `src/integrations/slack.py` |
| **Slack Block Kit** | Interactive review cards with approve/reject/revise buttons, feedback dropdown | `src/integrations/slack_blocks.py` |
| **Discord** | Send messages, thread replies via Discord API v10 | `src/integrations/discord.py` |
| **GitHub REST API** | Post comments, fetch issues (PAT-based) | `src/integrations/github.py` |
| **GitHub App** | JWT auth, installation tokens, webhook verification, issue-triggered pipelines | `src/integrations/github_app.py` |
| **SendGrid Email** | HTML templates for review notifications with action buttons | `src/integrations/email.py` |
| **LLM (Requesty)** | All LLM calls routed through Requesty proxy, per-stage model config | `src/integrations/llm.py` |

---

## Authentication & Authorization (✅ All Implemented)

| Feature | Description | Location |
|---------|-------------|----------|
| **Clerk JWT verification** | API authentication via Clerk-issued JWTs | `src/api/auth.py` |
| **Role-based access** | Admin and reviewer roles with `require_admin_role`/`require_reviewer_role` | `src/api/auth.py` |
| **HMAC review tokens** | Time-limited tokens (24h expiry) for Slack/email quick actions | `src/security/tokens.py` |
| **Webhook verification** | Slack (signing secret), GitHub (HMAC-SHA256), Clerk (Svix) | `src/api/routes/slack.py`, `github.py`, `clerk.py` |
| **Clerk webhooks** | Handles user/org/membership CRUD events | `src/api/routes/clerk.py` |

---

## API Endpoints (✅ All Implemented)

| Route | Endpoints | Description | Location |
|-------|-----------|-------------|----------|
| `/api/reviews` | GET pending, POST decide, GET detail | Auth'd review management | `src/api/routes/reviews.py` |
| `/api/review` | GET token, POST action | Token-based quick review (HMAC) | `src/api/routes/review.py` |
| `/api/reviewers` | Full CRUD + self-registration | Reviewer management + Clerk roles | `src/api/routes/reviewers.py` |
| `/api/knowledge` | POST fetch-url, POST, GET, DELETE | Knowledge base management | `src/api/routes/knowledge.py` |
| `/api/docs` | GET list, GET detail | Documentation browser | `src/api/routes/docs.py` |
| `/api/memory` | GET stats, GET search | Memory stats + semantic search | `src/api/routes/memory.py` |
| `/api/github` | Install, link, webhook, callback | GitHub App integration flow | `src/api/routes/github.py` |
| `/api/slack` | POST interactivity | Slack Block Kit button handler | `src/api/routes/slack.py` |
| `/api/clerk` | POST webhook | Clerk event handler | `src/api/routes/clerk.py` |

---

## Frontend (✅ All Implemented)

React 19 + TypeScript + Vite 8 + TailwindCSS 4 SPA with Clerk auth.

### Pages

| Page | Route | Description | Location |
|------|-------|-------------|----------|
| Landing | `/` | Marketing page with Clerk org selector | `frontend/src/pages/Landing.tsx` |
| SignIn / SignUp | `/sign-in`, `/sign-up` | Clerk authentication | `frontend/src/pages/SignIn.tsx`, `SignUp.tsx` |
| Dashboard | `/dashboard` | Pending review cards with confidence scores | `frontend/src/pages/Dashboard.tsx` |
| Review Detail | `/review/:id` | Document preview + approve/reject/revise workflow | `frontend/src/pages/ReviewDetail.tsx` |
| Reviewers | `/reviewers` | Admin CRUD, self-registration, role management | `frontend/src/pages/Reviewers.tsx` |
| Docs | `/docs` | Documentation browser with status badges | `frontend/src/pages/Docs.tsx` | 
| Knowledge | `/knowledge` | URL import, document upload, CRUD | `frontend/src/pages/Knowledge.tsx` |
| Memory | `/memory` | Stats dashboard + semantic search | `frontend/src/pages/Memory.tsx` |
| Settings | `/settings` | Org switching, team roles, GitHub App connection | `frontend/src/pages/Settings.tsx` |

### Components

| Component | Description | Location |
|-----------|-------------|----------|
| Layout | Shell with Header + Sidebar + Outlet | `frontend/src/components/Layout.tsx` |
| Header | Breadcrumbs, org badge, user button | `frontend/src/components/Header.tsx` |
| Sidebar | Nav links, role-conditional items | `frontend/src/components/Sidebar.tsx` |
| ProtectedRoute | Auth guard with Clerk | `frontend/src/components/ProtectedRoute.tsx` |
| AuthTokenSetter | Auto-refresh Clerk JWT tokens | `frontend/src/components/AuthTokenSetter.tsx` |
| ReviewCard | Review preview card | `frontend/src/components/ReviewCard.tsx` |
| Badge | Status badge with color variants | `frontend/src/components/Badge.tsx` |
| ConfidenceBar | Confidence percentage bar | `frontend/src/components/ConfidenceBar.tsx` |
| URLImportForm | Multi-step URL import with preview | `frontend/src/components/URLImportForm.tsx` |

---

## Knowledge Base (✅ Implemented)

| Feature | Description | Location |
|---------|-------------|----------|
| URL content fetching | Webpages (trafilatura), PDFs (PyMuPDF), Google Docs, Notion | `src/knowledge/url_fetcher.py` |
| Document ingestion | Chunking + embedding storage | `src/api/routes/knowledge.py` |
| Knowledge CRUD | Create, list, delete documents | `src/api/routes/knowledge.py` |

---

## CLI (✅ Implemented)

| Feature | Description | Location |
|---------|-------------|----------|
| Command-line ingestion | `python -m src.cli.draftly 'question' --org-id <id>` | `src/cli/draftly.py` |
| Full pipeline invocation | Compiles graph with checkpointer, runs all 8 nodes | `src/cli/draftly.py` |

---

## Infrastructure & DevOps (✅ All Implemented)

### AWS (Terraform)

| Resource | Description | Location |
|----------|-------------|----------|
| ECS Fargate | Cluster, task definition, service, ALB | `infrastructure/aws/ecs-service.tf` |
| ECR | Container registry with lifecycle policy (keep last 10) | `infrastructure/aws/ecr-repository.tf` |
| Staging env | Separate ECS deployment with smaller instances | `infrastructure/aws/staging.tf` |
| State backend | S3 with DynamoDB locking | `infrastructure/aws/main.tf` |

### Database (CockroachDB)

| Feature | Description | Location |
|---------|-------------|----------|
| 13-table schema | Multi-tenant with vector index support | `infrastructure/cockroachdb/schema.sql` |
| 7 migrations | Schema evolution (002-008) | `infrastructure/cockroachdb/migrations/` |
| Vector index | 3072-dim embeddings via C-SPANN | `src/memory/vector_store.py` |

### Docker

| Feature | Description | Location |
|---------|-------------|----------|
| Multi-stage build | Node frontend → Python runtime | `Dockerfile` |
| Docker Compose | Local dev (app + CockroachDB) | `docker-compose.yml` |

### CI/CD (GitHub Actions)

| Pipeline | Description | Location |
|----------|-------------|----------|
| CI | Lint (ruff) + typecheck (mypy) + test (pytest w/ CockroachDB) | `.github/workflows/ci.yml` |
| CD | Build → ECR → ECS (staging on `develop`, production on `main`) + smoke test | `.github/workflows/deploy.yml` |

### Scripts

| Script | Description | Location |
|--------|-------------|----------|
| `init_db.py` | Apply schema to CockroachDB | `scripts/init_db.py` |
| `seed_demo_data.py` | Seed demo orgs, threads, docs, embeddings | `scripts/seed_demo_data.py` |

---

## Tests (✅ Implemented)

16 test files covering core functionality.

| Test File | Coverage Area | Location |
|-----------|---------------|----------|
| `test_github_webhook.py` | Webhook endpoint: valid events, invalid signatures | `tests/` |
| `test_github_app.py` | JWT generation, webhook signature verification | `tests/` |
| `test_github_runner.py` | GitHub issue state initialization | `tests/` |
| `test_notifications.py` | Reviewer notifications via Slack/email | `tests/` |
| `test_rubrics.py` | Rubric definitions, confidence/feedback extraction | `tests/` |
| `test_investigation.py` | Complexity classification, plan generation | `tests/` |
| `test_hybrid_simple.py` | Unit tests for rubric, plan, classification | `tests/` |
| `test_tokens.py` | HMAC token generation, verification, expiry | `tests/` |
| `test_email.py` | SendGrid email sending | `tests/` |
| `test_url_fetcher.py` | URL content fetching (webpages, PDFs, etc.) | `tests/` |
| `test_reviewers.py` | Reviewer CRUD operations | `tests/` |
| `test_chunking.py` | Text chunking, embedding storage, knowledge ingestion | `tests/` |
| `test_slack_interactivity.py` | Slack interactivity endpoint | `tests/api/` |
| `test_slack_blocks.py` | Slack Block Kit card builder | `tests/integrations/` |
| `test_slack_blocks_param.py` | Slack message sending with blocks | `tests/integrations/` |

---

## Not Yet Implemented

| Feature | Notes | Status |
|---------|-------|--------|
| **CockroachDB MCP server insights** | MCP server is configured as IDE tool only (`opencode.json`), not an application feature | ❌ Not Implemented |
| **CI/CD production deployment** | CD pipeline exists but only staging is provisioned per PRD | ❌ Not Implemented |
| **Real-time streaming documentation** | Listed as out of scope in PRD | ❌ Out of Scope |
| **Multi-language support** | Planned for v2 per PRD | ❌ Out of Scope |
| **Custom LLM training** | Out of scope per PRD | ❌ Out of Scope |
| **Mobile application** | Out of scope per PRD | ❌ Out of Scope |

---

## API Client Layer (✅ Implemented)

Frontend API client modules with type-safe fetch wrapper.

| Module | Endpoints Called | Location |
|--------|-----------------|----------|
| `client.ts` | Base fetch wrapper, auto auth headers, 401 redirect | `frontend/src/api/client.ts` |
| `reviews.ts` | `/reviews/pending`, `/reviews/:id`, `/reviews/:id/decide` | `frontend/src/api/reviews.ts` |
| `reviewers.ts` | Full CRUD on `/reviewers/*` | `frontend/src/api/reviewers.ts` |
| `docs.ts` | `/docs/`, `/docs/:id` | `frontend/src/api/docs.ts` |
| `knowledge.ts` | `/knowledge`, `/knowledge/fetch-url` | `frontend/src/api/knowledge.ts` |
| `memory.ts` | `/memory/stats`, `/memory/search` | `frontend/src/api/memory.ts` |
| `github.ts` | `/github/install-url`, `/github/installations`, `/github/link` | `frontend/src/api/github.ts` |
