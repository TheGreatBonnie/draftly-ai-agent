# AGENTS.md

## Commands

```bash
# Backend
uv sync                                          # install deps
uv run uvicorn src.api.app:app --reload          # dev server (port 8000)
uv run python scripts/init_db.py                 # apply schema to CockroachDB
uv run python scripts/seed_demo_data.py          # seed demo data
uv run python -m src.cli.draftly "question"      # run full pipeline via CLI

# Frontend
cd frontend && npm install && npm run dev        # Vite dev server (proxies /api to :8000)

# Verification
uv run ruff check src/                           # lint
uv run mypy src/                                 # type check
uv run pytest                                    # tests (asyncio_mode=auto)
```

## Key Facts

- **Python 3.11+**, ruff (line-length 100, rules E/F/I/N/W/UP), mypy (`disallow_untyped_defs=true`)
- **CockroachDB** on port **26258** in docker-compose (not default 26257). Schema URL uses `defaultdb`, app URL uses `draftly`
- **All LLM calls** route through Requesty (`api.requesty.ai`), never directly to OpenAI/Anthropic. Default model: `tensorx/deepseek-v4-flash`
- **Per-stage models** configured via env: `RESEARCH_MODEL`, `REVIEW_MODEL`, `RUBRIC_GRADER_MODEL`
- **Frontend** is a React 19 SPA in `frontend/`, served by FastAPI from `frontend/dist/`. Not Jinja2 templates
- **LangGraph graph** lives in `src/agents/graph.py`. 8 nodes with conditional rubric-based routing. HITL via `interrupt()` + `Command(resume=...)`
- **Auth**: Clerk JWT verification (`src/api/auth.py`). HMAC tokens for quick review actions (`src/security/tokens.py`)
- **DB migrations**: Manual SQL files in `infrastructure/cockroachdb/migrations/`. No migration runner — applied via `scripts/init_db.py` or manually
- **Embeddings**: 3072-dimension vectors. Vector index created dynamically by `AsyncCockroachDBVectorStore.aapply_vector_index()`
- **Org FK references**: All child tables reference `organizations(clerk_org_id)` (STRING), not `organizations(id)` (UUID). This was changed in migration 007

## Gotchas

- `docker-compose.yml` maps CockroachDB to host port 26258, not 26257
- `src/api/templates/` does not exist — the frontend is React, not Jinja2
- `call_bedrock()` in `src/integrations/llm.py` is just an alias for `call_llm()` — no actual Bedrock calls
- `.github/` directory is empty — no CI/CD workflows
- The `embeddings` table has only 5 columns (id, content, embedding, metadata, created_at). org_id/content_type/content_id live inside the `metadata` JSONB field

## Context Files

- `context/SCHEMA.md` — 13-table database schema
- `context/ARCHITECTURE.md` — system architecture and component map
- `context/PRD.md` — product requirements
- `context/DESIGN.md` — frontend design system (React + TailwindCSS)
- `context/RULES.md` — coding conventions (SOLID, naming, commit format)
