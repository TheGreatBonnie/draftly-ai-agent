# Agent Event Display — Design

**Date:** 2026-08-01
**Status:** Approved design → spec
**Predecessor:** Agent event sink (migration 014, `src/analytics/events.py`, `GET /api/activity/events`) — merged to `develop`.

## Goal

Surface the agent-event telemetry captured by the sink across the Command Center and review flow, with the backend hardening needed to make it production-ready. Five placements:

1. KernelLog upgraded to live agent events
2. EngineViz driven by real pipeline stage data (not heuristics)
3. Live "Pipeline Activity" panel (rewire the dead static `LogStream`)
4. Health/error summary card + real header status
5. Per-draft pipeline trace on ReviewDetail

## Decisions (confirmed with user)

- **Live updates:** polling every 3s for event panels (30s for the health summary). No SSE — none exists today and the sink flushes every 5s anyway.
- **Per-draft linkage:** add `workflow_id` to `documentation` (migration 015) so a review/doc maps to its workflow via `doc_id → documentation.workflow_id`.
- **Scope:** full hardening included — `workflow_id` propagation, endpoint filters + summary aggregate, retention job.

## Current state (facts gathered)

- Events endpoint `GET /api/activity/events` (`src/api/routes/activity.py`) returns `event_type, level, details, created_at` — **no `workflow_id`** in SELECT or output.
- Runners (`slack_runner`, `github_runner`, `discord_runner`) create `workflow_id = str(uuid4())` but pass it **only** in runner-level `logger.info` calls. Graph state is built with `workflow_id: ""` (`build_slack_state`, `draftly.py`) and never assigned the real id, so **node-level stage events carry no `workflow_id`**.
- `src/memory/procedural.py` (`create_workflow`/`agent_workflows`) has **no callers** — dead code; do not depend on it for linkage.
- `review_sessions` joins to `documentation` (`rs.doc_id`) and `support_threads` (`d.source_thread_id`). `get_review` does not return `workflow_id`.
- `LogStream.tsx` renders static `DEFAULT_LOGS`; it is mounted on the Integrations page (`Settings.tsx:575`) and nowhere else.
- `KernelLog.tsx` polls `GET /api/activity/latest` (audit_logs) every 5s.
- `EngineViz` receives `currentTask`/`nextTask` computed by `getEngineAnnotations()` in `Dashboard.tsx` from the activity feed — a heuristic.
- `configure_logging()` already includes `structlog.contextvars.merge_contextvars` first in the processor chain → binding contextvars automatically tags every event logged inside the context.
- Frontend has no test runner (`npm run build` = tsc + vite; `npm run lint` = eslint).
- Known pre-existing failure: `tests/test_github_webhook.py::test_webhook_installation_created` (`get_or_create_org` rename) — fails on develop too, not in scope.

## Backend

### A. `workflow_id` propagation

Files: `src/agents/runners/slack_runner.py`, `src/agents/runners/github_runner.py`, `src/agents/runners/discord_runner.py`, `src/cli/draftly.py`

- After creating `workflow_id`, set `state["workflow_id"] = workflow_id` before `graph.ainvoke`.
- Wrap the invocation (and status-update log calls that follow) so every event logged during the run inherits the id:

```python
structlog.contextvars.bind_contextvars(workflow_id=workflow_id, org_id=org_id)
try:
    ...
finally:
    structlog.contextvars.clear_contextvars()
```

- CLI (`draftly.py`): generate a `workflow_id` (currently `""`), set it in state, bind contextvars around the run the same way.
- Guards: do not rebind for the Slack MCP pre-flight (before state is built). Keep `clear_contextvars()` in a `finally` so a failed run does not leak context into other tasks.

### B. Events endpoint upgrades

File: `src/api/routes/activity.py`

- `_serialize_event`: add `workflow_id` to output (SELECT `workflow_id`, serialize like others; `None` stays `None`).
- `GET /events` new optional query params:
  - `workflow_id: str | None` → `AND workflow_id = $n`
  - `level: str | None` → `AND level = $n`
  - `after: str = ""` (ISO datetime) → `AND created_at > $n` (cursor for incremental polling; mirrors `/latest`)
  - `limit` stays (`ge=1 le=200`).
  - All filters org-scoped (`WHERE org_id = $1` first).
- New `GET /api/activity/events/summary`:
  - Response: `{"last_1h": {level: count, ...}, "last_24h": {level: count, ...}}` (only levels present; frontend fills zeros).
  - SQL: two `SELECT level, count(*) ... WHERE org_id = $1 AND created_at > now() - interval '1 hour' GROUP BY level` queries (1h and 24h). `_serialize_summary` helper converts rows to `{level: count}` dicts.

Route order note: `/events/summary` must be defined; activity router has no `/{param}` route so ordering is safe.

### C. Migration 015

File: `infrastructure/cockroachdb/migrations/015_add_documentation_workflow.sql`

```sql
ALTER TABLE documentation ADD COLUMN IF NOT EXISTS workflow_id STRING;
CREATE INDEX IF NOT EXISTS idx_agent_events_org_workflow ON agent_events (org_id, workflow_id);
```

- No FK (workflow_id is an opaque UUID string; `agent_workflows` is dead code).
- Backfill on new docs: `write_docs_node` returns `doc_id` (merged into graph state, so `result.get("doc_id")` is available after `graph.ainvoke`). After a successful invoke, each runner runs:

```sql
UPDATE documentation SET workflow_id = $1 WHERE id = $2 AND workflow_id IS NULL
```

- Existing/legacy docs keep `workflow_id = NULL` → per-draft trace shows the empty state.
- `docs.py` selects `d.*`, so the new column auto-appears in doc list/detail responses with no route change. `get_review` (reviews.py) selects explicit columns, so add `d.workflow_id` there.

### D. Retention job

File: `src/analytics/events.py` (+ `src/config.py`, wiring in `src/api/app.py`, `main.py`, `src/cli/draftly.py`)

- New setting `event_retention_days: int = 90` (`EVENT_RETENTION_DAYS`).
- `_retention_loop(interval_hours=24)`: delete all rows regardless of org (table is global; org is nullable). SQL: `DELETE FROM agent_events WHERE created_at < now() - make_interval(days => $1)` (CockroachDB supports `make_interval`; parameterized, no string interpolation).
- Log `agent_event_retention` (rows deleted) / `agent_event_retention_failed` on exception; add **both** to `_SELF_TELEMETRY_EVENTS`.
- Lifecycle mirror of flusher: `start_retention()` idempotent, `stop_retention()` cancel+await. Started after `start_flusher()`, stopped before it on shutdown in app lifespan, main, and CLI.
- Failure isolation identical to the flush loop (never raises out).

## Frontend

### Shared pieces

- `frontend/src/api/types.ts`: add `AgentEvent { workflow_id: string | null; event_type: string; level: "info" | "warning" | "error"; details: Record<string, unknown>; created_at: string }` and `EventSummary { last_1h: Record<string, number>; last_24h: Record<string, number> }`.
- `frontend/src/api/activity.ts`: add `getAgentEvents(params: { limit?: number; workflowId?: string; level?: string; after?: string })` and `getEventSummary()`.
- `frontend/src/hooks/useAgentEvents.ts`: 3s polling; keep latest-first list capped at ~100; dedupe by `created_at+event_type`; silent-fail on error (KernelLog pattern); `pause`/`resume` controls; clear.
- `frontend/src/hooks/useEventSummary.ts`: 30s polling, silent-fail.
- `frontend/src/utils/events.ts`: `eventTypeLabel(event_type): string` central map and `levelBadgeTone(level)`. Label prefixes (exact match on the known event names; fallback = raw event_type with underscores → spaces):
  - `ingest_*` → "Ingesting <source> activity"
  - `research_*` → "Researching"
  - `memory_*` → "Retrieving context"
  - `review_*` → "Reviewing draft"
  - `write_*` → "Drafting"
  - `synthesize_*` → "Synthesizing"
  - `publish_*` → "Publishing"
  - `human_review_*` → "Awaiting review"
  - `verification`/`verify_*` → "Verifying"
  - `*_pipeline_*` → "Processing <platform> request"
  - `workflow_created` → "Workflow started"
  - else → humanize event_type.
- Event-type inventory: the prefixes above cover the events found in `src/agents` logger calls (see "Current state"); implementers must grep `logger.(info|warning|error)` in `src/agents` + runners during implementation and extend the map for any new `event_type` strings so unknown types fall back to humanized raw names.

### Placement 1 — KernelLog upgrade

File: `frontend/src/components/KernelLog.tsx`

- Replace `/activity/latest` (audit) polling with `useAgentEvents(limit=30, 3000)`.
- Row: `[HH:MM:SS]` + level badge (`[INFO]`/`[WARN]`/`[ERROR]`, color by tone) + `eventTypeLabel` + a short detail hint (first scalar value of `details` when present).
- Keep the terminal aesthetic, LIVE badge, auto-scroll, cap 30.

### Placement 2 — EngineViz truth

Files: `frontend/src/pages/Dashboard.tsx`, `frontend/src/components/EngineViz.tsx` (visual unchanged)

- `Dashboard` passes events to a new selector (in `utils/events.ts`): `deriveStageAnnotations(events)` → `{ currentTask, nextTask }`.
  - Group events by `workflow_id`; take the most recent workflow; `currentTask` = `eventTypeLabel(latestEvent.event_type)` (with source where relevant, e.g. "Ingesting slack activity"); `nextTask` = label of the next stage present for that workflow (or `null`).
  - Fallback: `"Waiting for activity..."` / `null` when no events.
- Delete `getEngineAnnotations()` heuristic.

### Placement 3 — Pipeline Activity panel

Files: `frontend/src/components/LogStream.tsx`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/Settings.tsx`

- Rewrite `LogStream` to consume `useAgentEvents(limit=100, 3000)`:
  - Header: "Live Agent Event Stream", LIVE indicator, CLEAR (client-side), level filter (All / Info / Warnings / Errors).
  - Rows: timestamp + level badge + `eventTypeLabel` + collapsible `details` (JSON, `<pre>` text, truncated preview ~120 chars when collapsed).
  - Pause-on-hover to prevent scroll jank; auto-scroll to newest unless user scrolled up.
  - Empty state ("No pipeline activity yet") and error state (silent, "Waiting for events…").
  - Level filter maps to `getAgentEvents({ level })` or client-side filter; prefer client-side filter (already capped at 100) — keep API call unfiltered.
- Dashboard: render `<LogStream />` as a new section (below KernelLog, above Action Required).
- Settings: replace the static `<LogStream />` block at line 575 with the same live component (keep a live instance on the Integrations page).

### Placement 4 — Health summary

Files: `frontend/src/components/HealthSummaryCard.tsx` (new), `frontend/src/pages/Dashboard.tsx`

- Card: `useEventSummary()` → three counts for 24h (errors / warnings / info). Green "NOMINAL" when `last_1h` errors === 0, amber "ATTENTION" otherwise. Clicking the error count sets the Pipeline panel's level filter to `error`.
- Header status: the "System Status: NOMINAL" line is inline in `Dashboard.tsx` (lines 96-98). `Dashboard` already owns `useEventSummary` (for the card); derive the status string there and render it — no `Header.tsx` change.
- Placement on dashboard: a slim full-width strip under the metric cards.

### Placement 5 — Per-draft trace

Files: `src/api/routes/reviews.py`, `src/api/routes/docs.py`, `frontend/src/pages/ReviewDetail.tsx`, `frontend/src/components/PipelineTrace.tsx` (new)

- Backend: add `d.workflow_id` to the `get_review` SELECT (reviews.py) and to the doc detail response (docs route) so both detail sessions get it.
- Frontend: after the doc/review loads, if `workflow_id` present → `getAgentEvents({ workflowId })`; render `PipelineTrace` card:
  - Chronological (oldest→newest), level-colored rows, `eventTypeLabel`, expandable `details`.
  - Collapsible section titled "Pipeline Trace" placed under the doc header card.
  - Empty state: "No pipeline trace recorded for this draft." (covers NULL/legacy docs and workflow_id="").
  - Loading + error states (silent).

## Error handling & privacy

- All polling silent-fails (KernelLog pattern) — never break the dashboard.
- Details rendered as text/`<pre>`, never `dangerouslySetInnerHTML`; previews truncated; full JSON expandable.
- Empty states for all panels; retention failures logged and loop continues.

## Testing & verification

- **Backend (pytest, TDD red→green per task):**
  - events endpoint: `workflow_id` filter, `level` filter, `after` cursor, and `workflow_id` in the serialized response.
  - summary endpoint: aggregate shape.
  - workflow_id propagation: bind contextvars → a logger call inside yields a record with `workflow_id` (unit test on `_build_record`/processor via a captured record).
  - retention: `_retention_loop` deletes only old rows (inject interval; patch `execute`).
  - migration 015: column + index applied (apply via inline asyncpg script against the configured DB; verify `information_schema`).
- **Frontend:** `npm run build` (tsc) + `npm run lint` clean; manual smoke of all 5 placements with a running backend.
- **Ops:** apply migrations 014 (if not yet) and 015; full `uv run pytest` → only the 1 known pre-existing failure.

## Out of scope

- SSE streaming.
- `src/memory/procedural.py` (`agent_workflows`) revival.
- Frontend unit-test framework.
- Fixing the pre-existing `test_github_webhook` failure.
- Populating `AgentTrace` enrichment (separate follow-up).
