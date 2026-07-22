# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Sources                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │  Slack  │  │ Discord │  │  GitHub │  │   CLI   │           │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘           │
└───────┼─────────────┼───────────┼─────────────┼─────────────────┘
        │             │           │             │
        ▼             ▼           ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Webhooks                           │
│  /api/slack  │  /api/discord  │  /api/github  │  /api/review   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LangGraph State Machine (8 nodes)              │
│                                                                 │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  │
│  │ Ingest │─▶│Memory  │─▶│Research│─▶│Synthe- │─▶│Write   │  │
│  │(hybrid)│  │Retrieve│  │(hybrid)│  │size    │  │Docs    │  │
│  └────────┘  └────────┘  └────────┘  └────────┘  └───┬────┘  │
│                                                       │        │
│                          ┌─────── rubric grading ◀────┘        │
│                          │                                      │
│                          ▼                                      │
│                   ┌────────────┐                                │
│              ┌───▶│  AI Review │───┐                            │
│              │    │  (rubric)  │   │                            │
│              │    └────────────┘   │                            │
│              │ needs_revision      │ satisfied                  │
│              │                     ▼                            │
│              │              ┌────────────┐                      │
│              └──────────────│   Human    │                      │
│                             │   Review   │                      │
│                             │(interrupt) │                      │
│                             └──┬───┬───┬─┘                      │
│                           approve│   │revise   │END             │
│                                ▼   │   ▼                        │
│                         ┌────────┐ │ ┌────────┐                 │
│                         │Publish │ │ │ Write  │──┐              │
│                         └────────┘ │ │ Docs   │◀─┘              │
│                                    │ └────────┘                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  CockroachDB  │   │  LLM APIs     │   │  Review       │
│  (13 tables)  │   │  (Requesty)   │   │  Dashboard    │
└───────────────┘   └───────────────┘   └───────────────┘
```

## Data Flow

### 1. Ingest (Hybrid)
- Receive support thread from Slack/Discord/GitHub/CLI
- Create `support_threads` record, log audit event
- Classify question complexity: simple / moderate / complex
- Select documentation type (howto, faq, tutorial, troubleshooting, reference)
- Select research skill based on question keywords

### 2. Memory Retrieve
- 4-way parallel memory retrieval:
  - **Semantic**: Vector similarity search via C-SPANN index on `embeddings`
  - **Episodic**: Full-text search on past `support_threads`
  - **Organizational**: Knowledge patterns from `agent_memory`
  - **Reviewer**: Historical feedback from `review_sessions`

### 3. Research (Hybrid)
- Generate investigation plan via `create_investigation_plan()` (2/4/7 tasks based on complexity)
- Execute DuckDuckGo web searches for each investigation task
- Synthesize search results into structured research output via LLM

### 4. Synthesize
- Merge thread content + memory context + research into a JSON `knowledge_package`
- Extract: key_facts, solutions, code_examples, gaps, sources, recommended_doc_type
- Apply organizational memory patterns

### 5. Write Docs
- Generate production-ready markdown documentation via LLM
- Apply confidence scoring
- Store draft in `documentation` table with status `draft`

### 6. AI Review (Rubric-Based)
- LLM-generated review of documentation quality
- Grade against `DOCUMENTATION_RUBRIC` (accuracy, completeness, clarity, grounding, format)
- Up to 3 iterative grading passes via `grade_with_rubric()`
- Route based on rubric status:
  - `needs_revision` → back to write_docs
  - `max_iterations_reached` (poor quality) → back to research
  - `satisfied` → human_review

### 7. Human Review (HITL)
- Create `review_sessions` record
- Notify assigned reviewers via Slack/Discord/Email
- `interrupt()` pauses LangGraph execution
- Resume via dashboard, Slack buttons, or email links using `Command(resume=...)`

### 8. Publish
- Update documentation status to `approved`/`published`
- Chunk document and store embeddings for semantic search
- Store in organizational memory
- Mark source thread as resolved
- Reply to originating platform (GitHub issue comment, Slack thread, Discord thread)

## Design Patterns

| Pattern | Usage |
|---------|-------|
| State Machine | LangGraph pipeline with conditional routing |
| Rubric Grading | Iterative LLM-as-a-judge evaluation (up to 3 passes) |
| HITL Interrupt | `interrupt()` + `Command(resume=...)` for human review pauses |
| Hybrid Deep-Agent | Question classification → skill selection → investigation planning |
| Repository Pattern | Database abstraction (`src/database.py`) via asyncpg |
| HMAC Tokens | Time-limited review tokens for Slack/email quick actions |

## Component Architecture

### Agents (`src/agents/`)
- `graph.py` — LangGraph state machine (`build_hybrid_graph()`, 8 nodes)
- `state.py` — `DocumentationState(TypedDict)` with 31 fields
- `rubrics.py` — 3 rubric definitions (DOCUMENTATION, RESEARCH, SYNTHESIS)
- `nodes/` — Pipeline node implementations:
  - `ingest.py` — Thread creation, question classification, skill selection
  - `memory.py` — 4-way memory retrieval
  - `research.py` — Investigation planning + web search
  - `synthesize.py` — Knowledge package generation
  - `write.py` — Documentation draft generation
  - `review.py` — AI review with rubric grading
  - `human.py` — HITL interrupt + reviewer notification
  - `publish.py` — Embedding storage + platform reply
- `skills/` — 5 research skills (api_question, configuration, troubleshooting, tutorial, conceptual)
- `planners/investigation.py` — Task-based investigation plan generator
- `runners/github_runner.py` — Full GitHub issue pipeline orchestrator
- `runners/resume.py` — Graph resume after human review decision
- `middleware/rubric.py` — Iterative rubric grading logic
- `tools/` — LangChain tool definitions:
  - `web_tools.py` — DuckDuckGo search
  - `github_tools.py` — GitHub issue search/retrieval
  - `memory_tools.py` — 4 memory search tools
  - `slack_tools.py` — Slack message search

### Memory (`src/memory/`)
- `episodic.py` — Support thread CRUD + full-text search
- `procedural.py` — Workflow tracking (`agent_workflows`)
- `organizational.py` — Team knowledge (`agent_memory`) + audit logging
- `reviewer.py` — Review session management (`review_sessions`)
- `reviewers.py` — Reviewer CRUD (`reviewers` table)
- `vector_store.py` — Semantic search via `AsyncCockroachDBVectorStore` (C-SPANN index)
- `chunking.py` — Document chunking (1000 chars / 200 overlap) + batch embedding storage
- `organizations.py` — Org management + GitHub installations/workflows
- `users.py` — Clerk user + org membership management

### Integrations (`src/integrations/`)
- `slack.py` — Slack API (messages, DMs, reactions)
- `slack_blocks.py` — Slack Block Kit interactive review cards (approve/reject/revise buttons)
- `discord.py` — Discord API (messages, thread replies)
- `github.py` — GitHub REST API (comments, issues)
- `github_app.py` — GitHub App auth (JWT, installation tokens, webhook verification)
- `email.py` — SendGrid email with HTML templates (review notifications with action buttons)
- `llm.py` — LLM abstraction layer (all calls routed through Requesty proxy)

### API (`src/api/`)
- `app.py` — FastAPI application, DB pool lifecycle, SPA catch-all
- `auth.py` — Clerk JWT verification, role-based access (admin, reviewer)
- `routes/` — API endpoints:
  - `reviews.py` — Auth'd review management (list pending, submit decision)
  - `review.py` — Token-based quick review (HMAC, no auth required)
  - `reviewers.py` — Reviewer CRUD + org member listing + self-registration
  - `github.py` — GitHub App install + webhook handler
  - `slack.py` — Slack interactivity handler (Block Kit button clicks)
  - `knowledge.py` — Knowledge base management (URL import, doc CRUD)
  - `memory.py` — Memory stats + semantic search
  - `docs.py` — Documentation listing and detail
  - `clerk.py` — Clerk webhook handler (user/org/membership events)

### Frontend (`frontend/`)
- **Stack**: React 19 + TypeScript + Vite 8 + TailwindCSS 4
- **Auth**: Clerk (`@clerk/react`)
- **Routing**: `react-router-dom`
- **Pages** (in `frontend/src/pages/`):
  - `Landing.tsx` — Marketing landing page
  - `SignIn.tsx` / `SignUp.tsx` — Clerk auth
  - `Dashboard.tsx` — Review dashboard (pending reviews)
  - `ReviewDetail.tsx` — Single review detail view
  - `Reviewers.tsx` — Reviewer management
  - `Docs.tsx` — Documentation browser
  - `Knowledge.tsx` — Knowledge base (upload, URL import)
  - `Memory.tsx` — Memory dashboard (stats + semantic search)
  - `Settings.tsx` — Org settings (GitHub App connection)
- **Components**: Layout, Sidebar, Header, ProtectedRoute, ReviewCard, ConfidenceBar, Badge, URLImportForm

### CLI (`src/cli/`)
- `draftly.py` — CLI entry point: `python -m src.cli.draftly 'question' --org-id <id>`

### Security (`src/security/`)
- `tokens.py` — HMAC-based review tokens (24h expiry, for Slack/email quick actions)

### Knowledge (`src/knowledge/`)
- `url_fetcher.py` — Multi-format URL content fetcher (webpages via trafilatura, PDFs via PyMuPDF, Google Docs, Notion)

### Services (`src/services/`)
- `clerk_admin.py` — Clerk Admin API (list org members, update roles)

## Infrastructure

### Database
- **CockroachDB** with distributed vector index (C-SPANN)
- 13 tables (see SCHEMA.md for full schema)
- Vector embeddings: 3072 dimensions via Requesty/OpenAI
- 7 applied migrations (002–008)

### Deployment
- **Docker**: Multi-stage build (Node frontend → Python runtime)
- **docker-compose**: Local dev (app + single-node CockroachDB)
- **AWS**: Terraform-managed ECR + ECS Fargate with ALB, CloudWatch logs
- **Entry point**: `main.py` → uvicorn → `src.api.app:app`

### Configuration
- `src/config.py` — Pydantic Settings: CockroachDB, Requesty, Slack, Discord, GitHub (PAT + App), Clerk, SendGrid, per-stage LLM models (research, review, rubric-grader)

## Security Considerations

- Multi-tenant isolation via `org_id` (references `organizations(clerk_org_id)`)
- Clerk JWT verification for API authentication (`src/api/auth.py`)
- HMAC time-limited tokens for Slack/email quick review actions (`src/security/tokens.py`)
- Webhook signature verification: Slack (signing secret), GitHub (HMAC-SHA256), Clerk (Svix)
- Role-based access: admin and reviewer roles via Clerk + `require_admin_role`/`require_reviewer_role` dependencies
- Audit logging for all agent/human/system actions
- Environment-based secret management
