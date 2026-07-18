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
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  /api/slack  │  /api/discord  │  /api/github  │  /cli  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LangGraph State Machine                      │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  │
│  │ Ingest │─▶│Memory  │─▶│Research│─▶│Synthe- │─▶│Write   │  │
│  │        │  │Retrieve│  │        │  │size    │  │Docs    │  │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────┬───┘  │
│                                                        │       │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐      │       │
│  │Publish │◀─│ Human  │◀─│   AI   │◀─┘        │◀─────┘       │
│  │        │  │ Review │  │ Review │                        │   │
│  └────────┘  └────────┘  └────────┘                        │   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  CockroachDB  │   │  LLM APIs     │   │  Review       │
│  (Memory)     │   │  (Requesty)   │   │  Dashboard    │
└───────────────┘   └───────────────┘   └───────────────┘
```

## Data Flow

### 1. Ingest
- Receive support thread from Slack/Discord/GitHub
- Parse thread metadata and content
- Store in `support_threads` table

### 2. Memory Retrieve
- Fetch relevant past documentation using vector search
- Load organizational knowledge from `agent_memory`
- Retrieve reviewer preferences

### 3. Research
- Search GitHub issues for related problems
- Search Slack messages for context
- Aggregate external context

### 4. Synthesize
- Combine thread content with research context
- Generate documentation outline using LLM
- Apply organizational memory patterns

### 5. Write Docs
- Generate full documentation draft
- Apply confidence scoring
- Store in `documentation` table

### 6. AI Review
- Validate documentation quality
- Check confidence score threshold
- Route to human review if confidence >= 0.7

### 7. Human Review
- Display in review dashboard
- Allow approve/reject/revise decisions
- Update documentation status

### 8. Publish
- Deploy approved documentation
- Update `published_to` field
- Notify integrations

## Design Patterns

| Pattern | Usage |
|---------|-------|
| State Machine | LangGraph pipeline orchestration |
| Repository Pattern | Database abstraction (`database.py`) |
| Strategy Pattern | Integration adapters (Slack, Discord, GitHub) |
| Observer Pattern | Webhook event handling |
| Factory Pattern | Document type creation |
| Circuit Breaker | External API failure handling |

## Component Architecture

### Agents (`src/agents/`)
- `graph.py` - LangGraph state machine definition
- `state.py` - Documentation state schema
- `nodes/` - Pipeline node implementations
- `tools/` - LangChain tool definitions

### Memory (`src/memory/`)
- `episodic.py` - Support thread memory
- `procedural.py` - Workflow memory
- `organizational.py` - Team knowledge
- `reviewer.py` - Human feedback memory
- `vector_store.py` - Semantic search

### Integrations (`src/integrations/`)
- `slack.py` - Slack API client
- `discord.py` - Discord API client
- `github.py` - GitHub API client
- `llm.py` - LLM API client

### API (`src/api/`)
- `app.py` - FastAPI application
- `routes/` - API endpoints
- `templates/` - Jinja2 templates

## Security Considerations

- Multi-tenant isolation via `org_id`
- Secret management via environment variables
- Webhook signature verification
- Rate limiting on external APIs
- Audit logging for all actions
