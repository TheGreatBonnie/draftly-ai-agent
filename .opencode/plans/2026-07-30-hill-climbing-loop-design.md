# Hill-Climbing Loop (Loop 4) Design Spec

## Overview

Implement the outermost loop of Draftly's four-loop agent architecture — a **self-improvement meta-loop** that collects execution traces, analyzes them with an LLM, generates improvement proposals for prompts/rubrics/tools, and applies them after human approval.

## Architecture

```
Agent Execution → Trace Collection (per-node timing) → Buffer (N traces)
                                                              │
                                                    (threshold reached)
                                                              │
                                                              ▼
                                                      LLM Analysis
                                                              │
                                                              ▼
                                                   Improvement Generation
                                                              │
                                                              ▼
                                                   Human Review (API)
                                                              │
                                                     ┌────────┴────────┐
                                                     ▼                 ▼
                                               Apply Change      Reject
                                          (prompt_versions /     (logged)
                                           rubric_versions /
                                           tool_configs)
```

## Data Model

### Migration 013

File: `infrastructure/cockroachdb/migrations/013_loop_engineering.sql`

Five new tables:

**`agent_traces`** — Raw execution traces for analysis
- `id UUID PK DEFAULT gen_random_uuid()`
- `org_id STRING NOT NULL`
- `workflow_id STRING NOT NULL`
- `trace_data JSONB NOT NULL`
- `created_at TIMESTAMPTZ DEFAULT now()`
- Index: `(org_id, created_at)`, `(workflow_id)`

**`harness_improvements`** — LLM-generated improvement proposals
- `id UUID PK DEFAULT gen_random_uuid()`
- `org_id STRING NOT NULL`
- `improvement_type STRING NOT NULL` — "prompt", "rubric", "tool"
- `proposed_changes JSONB NOT NULL`
- `rationale STRING`
- `status STRING DEFAULT 'pending'` — pending, approved, rejected, applied, failed
- `reviewed_by STRING`
- `reviewed_at TIMESTAMPTZ`
- `review_reason STRING`
- `created_at TIMESTAMPTZ DEFAULT now()`
- Index: `(org_id, status)`

**`prompt_versions`** — Source of truth for active prompts
- `id UUID PK DEFAULT gen_random_uuid()`
- `org_id STRING NOT NULL`
- `node_name STRING NOT NULL`
- `prompt_text STRING NOT NULL`
- `version INT NOT NULL`
- `is_active BOOLEAN DEFAULT false`
- `performance_score FLOAT`
- `created_at TIMESTAMPTZ DEFAULT now()`
- Index: `(org_id, node_name)`

**`rubric_versions`** — Versioned rubric criteria
- `id UUID PK DEFAULT gen_random_uuid()`
- `org_id STRING NOT NULL`
- `criterion_name STRING NOT NULL`
- `criterion_text STRING NOT NULL`
- `version INT NOT NULL`
- `is_active BOOLEAN DEFAULT false`
- `performance_score FLOAT`
- `created_at TIMESTAMPTZ DEFAULT now()`
- Index: `(org_id, criterion_name)`

**`tool_configs`** — Configurable tool definitions
- `id UUID PK DEFAULT gen_random_uuid()`
- `org_id STRING NOT NULL`
- `name STRING NOT NULL`
- `description STRING NOT NULL`
- `implementation_type STRING NOT NULL` — "http_get", "http_post", "code"
- `config JSONB NOT NULL`
- `enabled BOOLEAN DEFAULT true`
- `version INT NOT NULL DEFAULT 1`
- `created_at TIMESTAMPTZ DEFAULT now()`
- Index: `(org_id, name)`

## Component Specs

### `src/analytics/traces.py`

**Dataclasses:**
- `NodeTrace`: node_name, start_time, end_time, duration_ms, error, input_state (truncated), output_state (truncated)
- `AgentTrace`: trace_id, org_id, workflow_id, question, question_type, source, node_traces[], total_duration_ms, rubric_results[], verification_results[], human_decisions[], final_confidence, published, publish_urls[], timestamp

**`TraceCollector`:**
- In-memory buffer with configurable flush threshold (default 100)
- `collect(agent_trace)` → buffer, flush if threshold reached
- `flush()` → batch INSERT into agent_traces
- `get_traces_for_analysis(org_id, time_window=7d)` → fetch from DB
- All operations wrapped in try/except — never block the graph

### `src/analytics/analyzer.py`

**`analyze_production_traces(traces)`:**
1. Summarize traces (total count, avg confidence, node stats, failure/quality summary)
2. Call LLM with ANALYSIS_PROMPT to identify failure patterns, quality patterns, performance bottlenecks, improvement suggestions
3. Parse JSON response with regex fallback
4. Enrich with computed metrics
5. Return structured dict: failure_patterns[], quality_patterns[], performance_patterns[], improvements.{prompts, tools, rubrics}, confidence_trend, overall_health

### `src/analytics/improver.py`

- `ImprovementProposal` dataclass: id, org_id, type, proposed_changes, rationale, status, reviewed_by, reviewed_at
- `generate_improvements(analysis, current_config)` → LLM produces concrete rewrites
- `create_improvement_proposals(org_id, improvements)` → store to DB
- `apply_improvement(proposal)` → updates prompt_versions/rubric_versions/tool_configs, toggles is_active
- `load_current_config(org_id)` → reads active prompts/rubrics/tools from DB

### `src/analytics/hill_climber.py`

- `HillClimber` orchestrator holding TraceCollector + analyzer + improver
- `run_analysis_cycle(org_id)` → fetch traces → analyze → generate → store proposals
- Triggered as fire-and-forget asyncio task when buffer threshold reached

### `src/api/routes/improvements.py`

| Method | Path | Purpose |
|---|---|---|
| GET | /api/improvements/pending | List pending proposals |
| GET | /api/improvements/{id} | Get proposal details |
| POST | /api/improvements/{id}/approve | Approve + auto-apply |
| POST | /api/improvements/{id}/reject | Reject with reason |
| GET | /api/prompts/active | List active prompts |
| GET | /api/rubrics/active | List active rubrics |
| GET | /api/tools/config | List configured tools |

Protected by existing Clerk JWT auth.

## Graph Integration

### State changes (`src/agents/state.py`)
- Add `_node_traces: list[NodeTrace]` to DocumentationState
- Add `_trace_collected: bool`

### Node wrapping (`src/agents/graph.py`)
Each node wrapped to capture timing:
1. Record start_time before node function
2. Record end_time after return
3. Create NodeTrace, append to state["_node_traces"]

### Collector node
A `collect_trace` node added after publish (and all terminal paths):
1. Build AgentTrace from accumulated data
2. Call trace_collector.collect()
3. Trigger analysis cycle if buffer threshold reached

### Prompt/Rubric/Tool loading
- On startup: upsert current prompt/rubric constants into versioning tables as version 1
- At runtime: nodes fetch active config from DB with in-memory LRU cache (TTL 5 min), fall back to hardcoded constants
- On apply: new version inserted, old deactivated, cache invalidated
- Tools: loaded from tool_configs at startup, dynamically wrapped as LangChain-compatible functions

## Config Changes (`src/config.py`)

```python
analysis_model: str = "tensorx/deepseek-v4-flash"
trace_analysis_interval: int = 100
auto_apply_improvements: bool = False
trace_retention_days: int = 90
deterministic_verification_enabled: bool = True
max_verification_issues_per_type: int = 10
```

## Error Handling

All analytics operations are try/except — log and continue, never block the agent pipeline.

## Implementation Phases

### Phase 1: Trace Foundation
- traces.py — dataclasses + collector
- Migration 013 SQL
- config.py — new settings
- state.py — new fields
- graph.py — node wrapping + collector node
- Startup seeding of prompt/rubric version 1

### Phase 2: Analysis & Improvement
- analyzer.py — LLM analysis
- improver.py — improvement generation + application
- DB-backed config loading for prompts/rubrics/tools

### Phase 3: Human Review
- improvements.py — API endpoints
- Wire into main app router

### Phase 4: Orchestration
- hill_climber.py — orchestrator
- main.py — startup init + background task
- End-to-end wiring
