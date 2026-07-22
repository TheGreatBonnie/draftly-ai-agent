# Product Requirements Document

## Project Scope

Draftly is an autonomous documentation engineering platform that transforms support conversations into production-ready documentation using AI agents, CockroachDB, and AWS. It ingests threads from Slack, Discord, GitHub, and CLI, runs them through a rubric-graded LangGraph pipeline with human-in-the-loop review, and publishes documentation back to the originating platform.

## MVP Features

### Core Pipeline
- LangGraph 8-node state machine with conditional routing and HITL interrupts
- Rubric-based evaluation with up to 3 iterative LLM-as-a-judge grading passes
- Automated ingestion from Slack, Discord, GitHub (via GitHub App webhooks), and CLI
- Question classification (simple / moderate / complex) driving research depth
- Investigation plan generation (2 / 4 / 7 tasks based on complexity)
- Semantic search across documentation and support threads via CockroachDB C-SPANN vector index
- Versioned documentation with confidence scoring
- Document chunking (1000 chars / 200 overlap) for embedding storage

### Memory System
- **Episodic Memory**: Support thread history and context
- **Procedural Memory**: Agent workflow states and decisions
- **Organizational Memory**: Team knowledge and patterns
- **Reviewer Memory**: Human feedback and approval history
- **Semantic Memory**: 3072-dimension vector embeddings for similarity search

### Research Skills
- 5 domain-specific research skills: api_question, configuration, troubleshooting, tutorial, conceptual
- Each skill defines search priority, queries, validation rules, and citation format
- Keyword-based skill selection at ingest time

### Integrations
- Slack API client with Block Kit interactive review cards (approve/reject/revise buttons)
- Discord API client for messages and thread replies
- GitHub App integration (JWT auth, installation tokens, webhook verification, issue-triggered pipelines)
- GitHub REST API client (PAT-based, for direct comments/issues)
- SendGrid email with HTML templates for review notifications
- Requesty/OpenAI-compatible API for all LLM reasoning (per-stage model configuration)

### Authentication & Authorization
- Clerk JWT verification for API authentication
- Role-based access control: admin and reviewer roles
- HMAC time-limited review tokens (24h expiry) for Slack/email quick actions
- Webhook signature verification: Slack (signing secret), GitHub (HMAC-SHA256), Clerk (Svix)

### Review Dashboard
- React 19 SPA with Clerk auth (sign-in, sign-up, org management)
- Review dashboard with pending review cards and confidence scores
- Review detail view with document preview and approve/reject/revise workflow
- Reviewer management (CRUD, org member listing, self-registration)
- Documentation browser
- Knowledge base management (document upload, URL import for webpages/PDFs/Google Docs/Notion)
- Memory dashboard (stats + semantic vector search)
- Organization settings (GitHub App connection)
- Slack interactive cards with Block Kit buttons for quick review actions
- Email review links with HMAC tokens for quick review actions

### CLI
- Command-line ingestion: `python -m src.cli.draftly 'question' --org-id <id>`
- Compiles graph with CockroachDB checkpointer, invokes full pipeline, prints results

## Technical Requirements

### Stack
- Python 3.11+ with FastAPI
- LangGraph for agent orchestration (state machine, conditional routing, HITL interrupts)
- CockroachDB with distributed vector index (C-SPANN, 3072-dimension embeddings)
- Requesty/OpenAI-compatible API for LLM (per-stage models for research, review, rubric-grader)
- React 19 + TypeScript + Vite 8 + TailwindCSS 4 (frontend SPA)
- Clerk for authentication and organization management
- SendGrid for email delivery

### Infrastructure
- Containerized deployment via Docker multi-stage build (Node frontend → Python runtime)
- Docker Compose for local development (app + single-node CockroachDB)
- AWS ECS Fargate with ALB, CloudWatch logs
- AWS ECR for container registry with lifecycle policy (keep last 10 images)
- Terraform-managed infrastructure (ECR, ECS, staging environment)

## Database

- 13 CockroachDB tables (see SCHEMA.md for full schema)
- Multi-tenant isolation via `org_id` referencing `organizations(clerk_org_id)`
- 7 applied migrations (002–008): reviewers, GitHub tables, thread_id on reviews, notification toggles, Clerk tables, Clerk org ID as PK, reviewer Clerk user linking

## Success Metrics

| Metric | Target |
|--------|--------|
| Documentation accuracy score | >= 0.8 |
| Time to generate docs | < 5 minutes |
| Human review approval rate | >= 90% |
| Support thread coverage | >= 80% |
| Agent workflow completion rate | >= 95% |

## Out of Scope

- Real-time streaming documentation
- Multi-language support (v2)
- Custom LLM training
- Mobile application
- CI/CD with GitHub Actions (planned, not yet implemented)
- Production AWS environment (only staging provisioned)
