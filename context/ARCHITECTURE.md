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
┌──────────────────────────────────────────────────────────────────────────┐
│                  LangGraph State Machine (9 nodes + tracing)             │
│                                                                          │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐            │
│  │ Ingest │─▶│Memory  │─▶│Research│─▶│Synthe- │─▶│Write   │            │
│  │(hybrid)│  │Retrieve│  │(hybrid)│  │size    │  │Docs    │            │
│  └────────┘  └────────┘  └────────┘  └────────┘  └───┬────┘            │
│                                                       │                 │
│                          ┌─────── rubric grading ◀────┘                 │
│                          │                                               │
│                          ▼                                               │
│                   ┌────────────┐                                         │
│              ┌───▶│  AI Review │───┐                                     │
│              │    │  (rubric)  │   │                                     │
│              │    └────────────┘   │                                     │
│              │ needs_revision      │ satisfied                           │
│              │                     ▼                                     │
│              │              ┌────────────┐                               │
│              └──────────────│   Human    │                               │
│                             │   Review   │                               │
│                             │(interrupt) │                               │
│                             └──┬───┬───┬─┘                               │
│                     approve    │   │  revise    reject/END               │
│                                ▼   │   ▼                                 │
│                         ┌────────┐ │ ┌────────┐          ┌─────────────┐ │
│                         │Publish │ │ │ Write  │──┐       │  Collect    │ │
│                         └────┬───┘ │ │ Docs   │◀─┘       │   Trace     │ │
│                              │     │ └────────┘           └──────┬──────┘ │
│                              └─────┼─────────────────────────────┘        │
│                                    └──── all terminal paths ──▶ collect──▶│
│                                                                   trace   │
│                                                                    │      │
│                                                                    ▼      │
│                                                                   END     │
└──────────────────────────────────────────┬────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  CockroachDB  │   │  LLM APIs     │   │  Review       │
│  (17 tables)  │   │  (Requesty)   │   │  Dashboard    │
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

### 9. Collect Trace (Hill-Climbing)
- Terminal node reached from all end paths (publish, rejected, completed)
- Node-level timing data collected via `_wrap_node_with_tracing()` on all 8 pipeline nodes
- Builds `AgentTrace` from state: node durations, errors, confidence, publish status
- `TraceCollector.collect()` buffers trace in memory
- When buffer reaches `trace_analysis_interval` threshold, flushes to `agent_traces` table
- On flush, `HillClimber.should_analyze()` checks if analysis cycle is due
- If yes, async task runs: fetch traces → LLM analysis → generate improvements → store proposals
- Proposals reviewed via `/api/improvements/*` endpoints; approved proposals are applied to prompt/rubric/tool configs

## Design Patterns

| Pattern | Usage |
|---------|-------|
| State Machine | LangGraph pipeline with conditional routing |
| Rubric Grading | Iterative LLM-as-a-judge evaluation (up to 3 passes) |
| HITL Interrupt | `interrupt()` + `Command(resume=...)` for human review pauses |
| Hybrid Deep-Agent | Question classification → skill selection → investigation planning |
| Repository Pattern | Database abstraction (`src/database.py`) via asyncpg |
| HMAC Tokens | Time-limited review tokens for Slack/email quick actions |
| Hill-Climbing | Buffer-based trace collection → LLM analysis → improvement proposal generation → human approval → auto-apply |

## Component Architecture

### Agents (`src/agents/`)
- `graph.py` — LangGraph state machine (`build_hybrid_graph()`, 9 nodes + node tracing wrappers)
- `state.py` — `DocumentationState(TypedDict)` with 33 fields
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
- `runners/slack_runner.py` — Full Slack thread pipeline orchestrator
- `runners/discord_runner.py` — Full Discord @mention pipeline orchestrator
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
- `slack_app.py` — Slack Bolt app setup and event routing
- `slack_socket.py` — Slack Socket Mode WebSocket connection for real-time events
- `slack_conversation.py` — Thread-aware bot conversation memory
- `slack_feedback.py` — Slack feedback collection
- `slack_home.py` — Slack Home tab setup
- `slack_mcp.py` — MCP server for Slack data access
- `slack_status.py` — Slack status management
- `slack_store.py` — CockroachDB-backed Bolt installation store
- `markdown_to_slack.py` — Markdown to Slack mrkdwn conversion
- `discord.py` — Discord REST API (messages, thread replies, reactions)
- `discord_app.py` — Discord Gateway event handler (MESSAGE_CREATE processing)
- `discord_gateway.py` — Discord Gateway WebSocket client (persistent connection, auto-reconnect)
- `discord_blocks.py` — Discord interactive review cards (embeds, buttons, select menus)
- `discord_interactions.py` — Discord interaction token mapping for review actions
- `github.py` — GitHub REST API (comments, issues)
- `github_app.py` — GitHub App auth (JWT, installation tokens, webhook verification)
- `email.py` — SendGrid email with HTML templates (review notifications with action buttons)
- `llm.py` — LLM abstraction layer (all calls routed through Requesty proxy)

### Analytics (`src/analytics/`)
- `traces.py` — `NodeTrace`/`AgentTrace` dataclasses, `TraceCollector` with buffer/flush/callback
- `analyzer.py` — LLM-based trace analysis (`analyze_production_traces()`)
- `improver.py` — `ImprovementProposal` dataclass, proposal generation, application logic, config loading
- `hill_climber.py` — `HillClimber` orchestrator (interval-based analysis cycle)
- `seed.py` — Startup seeding of version 1 prompt/rubric configs

### API (`src/api/`)
- `app.py` — FastAPI application, DB pool lifecycle, SPA catch-all; lifespan initializes `TraceCollector` + `HillClimber`
- `auth.py` — Clerk JWT verification, role-based access (admin, reviewer)
- `routes/` — API endpoints:
  - `reviews.py` — Auth'd review management (list pending, submit decision)
  - `review.py` — Token-based quick review (HMAC, no auth required)
  - `reviewers.py` — Reviewer CRUD + org member listing + self-registration
  - `github.py` — GitHub App install + webhook handler
  - `slack.py` — Slack interactivity handler (Block Kit button clicks)
  - `discord.py` — Discord interaction handler (component clicks) + settings (guild link, trigger channels, invite URL)
  - `knowledge.py` — Knowledge base management (URL import, doc CRUD)
  - `memory.py` — Memory stats + semantic search
  - `docs.py` — Documentation listing and detail
  - `clerk.py` — Clerk webhook handler (user/org/membership events)
  - `improvements.py` — 7 endpoints: list pending proposals, detail, approve, reject, active prompts, active rubrics, tool configs

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
- 22 tables (see SCHEMA.md for full schema)
- Vector embeddings: 3072 dimensions via Requesty/OpenAI
- 12 applied migrations (002–013)

### Deployment
- **Docker**: Multi-stage build (Node frontend → Python runtime)
- **docker-compose**: Local dev (app + single-node CockroachDB)
- **AWS**: Terraform-managed ECR + ECS Fargate with ALB, CloudWatch logs
- **Entry point**: `main.py` → uvicorn → `src.api.app:app`

### Configuration
- `src/config.py` — Pydantic Settings: CockroachDB, Requesty, Slack, Discord, GitHub (PAT + App), Clerk, SendGrid, per-stage LLM models (research, review, rubric-grader), hill-climbing settings (analysis_model, trace_analysis_interval, auto_apply_improvements, trace_retention_days), verification settings (deterministic_verification_enabled, max_verification_issues_per_type). model_config includes `"extra": "ignore"` for env var overrides.

## Security Considerations

- Multi-tenant isolation via `org_id` (references `organizations(clerk_org_id)`)
- Clerk JWT verification for API authentication (`src/api/auth.py`)
- HMAC time-limited tokens for Slack/email quick review actions (`src/security/tokens.py`)
- Webhook signature verification: Slack (signing secret), GitHub (HMAC-SHA256), Clerk (Svix)
- Role-based access: admin and reviewer roles via Clerk + `require_admin_role`/`require_reviewer_role` dependencies
- Audit logging for all agent/human/system actions
- Environment-based secret management
