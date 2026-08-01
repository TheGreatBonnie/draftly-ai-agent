# Implementation Plan: Agent Event Display (2026-08-01)

**Spec:** `docs/superpowers/specs/2026-08-01-agent-event-display-design.md`
**Branch:** `feat/agent-event-display` (worktree from `develop`)
**Verify commands:** backend `uv run pytest`, `uv run ruff check src/`, `uv run mypy src/`; frontend `npm run build`, `npm run lint`
**Pre-existing failures (out of scope, do not fix):** `tests/test_github_webhook.py::test_webhook_installation_created` (1 failure), ruff `discord.py:330` N806 + `users.py:36` E501, mypy `slack_mcp.py:40` (mcp 2.0.0 dep drift)

---

## 1. Overview

Surface captured `agent_events` telemetry (sink shipped in prior plan, merged at `adfb26e`) in five UI placements, and harden the backend so events carry `workflow_id`, support filtering/summaries, and self-clean via retention.

The five placements:
1. **KernelLog upgrade** (`frontend/src/components/KernelLog.tsx`) — replace static audit polling with live agent events; level badge + event-type label + timestamp; auto-scroll + capped list.
2. **EngineViz truth** (`frontend/src/components/EngineViz.tsx` + `Dashboard.tsx`) — derive `currentTask`/`nextTask` from most recent events instead of the `getEngineAnnotations()` heuristic.
3. **Pipeline Activity panel** (`frontend/src/pages/Dashboard.tsx`) — rewire the static `LogStream`/`DEFAULT_LOGS` to live events; keep the static instance on Settings.
4. **Health summary** (`frontend/src/pages/Dashboard.tsx:96-98`) — real header status (errors → warning; idle/nominal) + an error/warning summary widget from `GET /events/summary` (30s poll).
5. **Per-draft trace** (`frontend/src/pages/ReviewDetail.tsx`) — per-document event timeline keyed by `documentation.workflow_id`.

## 2. Backend changes

### 2.1 Migration 015 — workflow_id linkage + index
`infrastructure/cockroachdb/migrations/015_add_documentation_workflow.sql` (manual SQL, no runner):

```sql
ALTER TABLE documentation ADD COLUMN IF NOT EXISTS workflow_id STRING;
CREATE INDEX IF NOT EXISTS idx_agent_events_org_workflow ON agent_events (org_id, workflow_id);
```

Apply to live DB via inline asyncpg script with `--env-file .env` (same pattern as migration 014).

### 2.2 `src/config.py` (:68, after `event_buffer_size`)
```python
event_retention_days: int = 90
```

### 2.3 `src/analytics/events.py`
- **`_retention_loop(interval_hours: float = 24.0)`** — forever loop mirroring `_flusher_loop`; sleeps interval first, then calls `_run_retention_once()`, logs self-telemetry `agent_event_retention` or `agent_event_retention_failed` on error. Accepts `stop_event` param for testability.
- **`_run_retention_once() -> int`** — `fetch_all("DELETE FROM agent_events WHERE created_at < now() - make_interval(days => $1) RETURNING id", settings.event_retention_days)`; returns deleted count.
- **`start_retention() -> asyncio.Task`** / **`stop_retention() -> None`** — module-level task + cancel/await, idempotent (guard on existing task), mirrors `start_flusher`/`stop_flusher`.
- Add `agent_event_retention` and `agent_event_retention_failed` to `_SELF_TELEMETRY_EVENTS` (:27).

### 2.4 `src/api/routes/activity.py`
- **`get_agent_events`** gains optional params: `workflow_id: str | None = None`, `level: str | None = None`, `after: str = ""` (ISO-8601 cursor). Build `WHERE`/params in existing method using dynamic `AND` conditions (method handles empty). All filters org-scoped (`WHERE org_id = $1` first). No total-count query — the list response is capped by `limit`.
- **`_serialize_event`** (existing helper) adds `row["workflow_id"]` → `str | None` to output.
- **New route `GET /events/summary`** — `EventSummary` Pydantic response: `{"last_1h": {level: count}, "last_24h": {level: count}}` from two `GROUP BY level` queries scoped to org + (optional) workflow_id.
- **Route ordering:** register `/events/summary` BEFORE `/events/{...}` if a param route exists. Currently only `/events` (no param) exists — verify no collision; keep `/events/summary` before `/events` anyway for safety.

### 2.5 `src/api/routes/reviews.py` — `get_review`
Add `d.workflow_id` to the explicit column select so the trace view can join events.

### 2.6 Workflow_id propagation (runners + CLI)
Goal: node-level `logger.info(...)` calls inside `graph.ainvoke` get `workflow_id` (and `org_id`) via structlog contextvars. `configure_logging()` already runs `merge_contextvars` first.

Pattern in each of 4 entrypoints (github_runner, discord_runner, slack_runner, `src/cli/draftly.py`):
1. Before invoke: `state["workflow_id"] = workflow_id` (already set to `str(uuid4())` in runners; CLI currently sets `"workflow_id": ""` at :54 → replace with `str(uuid4())`).
2. Wrap the `await graph.ainvoke(state, config)` call:
   ```python
   structlog.contextvars.bind_contextvars(workflow_id=workflow_id, org_id=org_id)
   try:
       result = await graph.ainvoke(state, config)
   finally:
       structlog.contextvars.clear_contextvars()
   ```
3. After successful invoke, persist linkage: `UPDATE documentation SET workflow_id=$1 WHERE id=$2 AND workflow_id IS NULL` with `result.get("doc_id")`. Only where a doc is produced (runners that reach write node). Best placed where `doc_id` is available post-invoke.

Note: `create_workflow`/`agent_workflows` in `src/memory/procedural.py` is dead code — do NOT use.

### 2.7 Docs route
`docs.py` uses `d.*` → `workflow_id` auto-propagates. No change needed (verify in test).

## 3. Frontend changes

### 3.1 Foundation
- **`frontend/src/api/types.ts`** — add `AgentEvent`, `EventLevel`, `EventSummary` types.
- **`frontend/src/api/activity.ts`** — add `getAgentEvents(params?: {workflowId?, level?, after?})` and `getEventSummary()`.
- **`frontend/src/hooks/useAgentEvents.ts`** — 3s polling, capped at 100, silent-fail (mirror KernelLog), returns `{events, loading}`.
- **`frontend/src/hooks/useEventSummary.ts`** — 30s polling of summary.
- **`frontend/src/utils/events.ts`** — `eventTypeLabel(et)` (prefix map `ingest_*`→Ingest, `research_*`→Research, `memory_*`→Memory, `review_*`→Review, `write_*`→Write, `synthesize_*`→Synthesis, `publish_*`→Publish, `human_review_*`→Human Review, `verify_*`→Verify, `*_pipeline_*`→Pipeline, `workflow_created`→Workflow; fallback humanized raw), `levelTone(level)` → `{info: "blue", warning: "amber", error: "red"}`, `formatEventTime(iso)`.

### 3.2 Placement 1 — KernelLog
`KernelLog.tsx`: poll `getAgentEvents` every 3s; render `[time] [level badge] event-type-label` lines; auto-scroll to bottom; cap list at 100; silent-fail keeps last state.

### 3.3 Placement 3 — Dashboard Pipeline Activity
`Dashboard.tsx`: replace static `DEFAULT_LOGS` mount with live `useAgentEvents` feed in the activity panel. Keep `LogStream`/`DEFAULT_LOGS` on `Settings.tsx:575` unchanged.

### 3.4 Placement 4 — Health summary + header status
- `Dashboard.tsx:96-98` "System Status NOMINAL" → derive from `getEventSummary`: any `error` in last_1h → status warning/error; else nominal. Color + label.
- Add small error/warning summary widget (counts last_1h/last_24h) fed by `useEventSummary` (30s).

### 3.5 Placement 2 — EngineViz truth
`Dashboard.tsx` `getEngineAnnotations()` → replaced by deriving `currentTask`/`nextTask` from latest `AgentEvent` (`workflow_created`/`ingest_*` → current). Pass events into `EngineViz`; fall back to existing heuristic when empty.

### 3.6 Placement 5 — Per-draft trace
`ReviewDetail.tsx`: `useAgentEvents({workflowId: doc.workflow_id})` when present; render timeline of that workflow's events. Hide section when `workflow_id` absent (pre-015 backfill docs).

## 4. Tasks (TDD order)

1. **T1 Backend propagation** — state/workflow_id contextvars binding + doc_id backfill in 4 entrypoints. Tests: runner/cli unit tests assert `UPDATE documentation` runs with workflow_id and `bind_contextvars` invoked (patch `graph.ainvoke`), and CLI uses non-empty workflow_id.
2. **T2 Endpoint filters + summary** — extend `get_agent_events` (workflow_id/level/after) + `/events/summary` + `_serialize_event` workflow_id. Update existing fixtures in `tests/api/test_activity_events.py` (add `workflow_id` to mock rows). New tests: filter passthrough, summary grouping, after-cursor SQL, empty org guard.
3. **T3 Migration 015 + reviews.get_review column** — write migration file; add `d.workflow_id` to get_review. Apply migration to live DB (verify `\d documentation` + `\d agent_events`). Tests: reviews route test asserts workflow_id present (patch fetch).
4. **T4 Retention** — `_retention_loop`/`_run_retention_once`/`start_retention`/`stop_retention` + settings + `_SELF_TELEMETRY_EVENTS` + wiring: app lifespan (`app.py`) — `start_retention()` right after `start_flusher()` (:42), `stop_retention()` right before `stop_flusher()` (:77); CLI (`draftly.py`) — `start_retention()` after `start_flusher()` (:26), `stop_retention()` after `stop_flusher()` (:80). `main.py` is unchanged (it never manages the flusher). Tests: `_run_retention_once` deletes with correct SQL (patch fetch_all), self-telemetry emitted, lifecycle idempotent (mirror flusher tests).
5. **T5 Frontend foundation** — types, api, hooks, utils. `npm run lint` + `npm run build` green.
6. **T6 Placements 1+3** — KernelLog + Dashboard activity panel.
7. **T7 Placement 4** — header status + summary widget.
8. **T8 Placement 2** — EngineViz events-driven stage.
9. **T9 Placement 5** — ReviewDetail trace timeline.
10. **T10 Ops verification** — full suite, ruff, mypy (branch files clean; pre-existing errors documented), `npm run build`, manual smoke on live app.

## 5. Risks / Notes
- **`execute()` returns `str`** (command status) — retention must use `fetch_all` + `RETURNING id` to count. (database.py:46-48)
- `merge_contextvars` context wins over explicit kwargs (explicit org_id kwargs are safe; `update` order = context first then event_dict).
- Existing `test_activity_events.py` fixtures lack `workflow_id` — update them or `_serialize_event` must use `.get()`. Prefer updating fixtures to assert the new field.
- Checkpointer `async with` context: contextvars binding must wrap `ainvoke` (inside the `async with` block). Post-invoke status log calls in slack/discord pass `workflow_id` explicitly already — no change needed.
- `DocumentationState.workflow_id` exists in TypedDict (state.py:47) — safe to set.
- No SSE infra; polling chosen (user-approved).
- Frontend has no test runner — verify via build/lint + manual smoke.
