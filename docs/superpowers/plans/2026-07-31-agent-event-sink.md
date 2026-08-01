# Agent Event Sink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every structlog event (currently terminal-only) into a persistent `agent_events` table via a structlog processor + buffered async flusher, so the dashboard has full pipeline telemetry with zero changes to the ~80 existing `logger.info/error` call sites.

**Architecture:** A custom structlog processor snapshots each structured event into an in-memory deque; a background asyncio task (wired into the FastAPI lifespan, mirroring the existing `TraceCollector` pattern) drains the buffer in batches into `agent_events`. `audit_logs` stays strictly for audit records; a new read endpoint `GET /api/activity/events` exposes the captured telemetry.

**Tech Stack:** Python 3.11, structlog 24+, asyncpg, CockroachDB, FastAPI, pytest (asyncio_mode=auto)

**Files created:**
- `infrastructure/cockroachdb/migrations/014_add_agent_events.sql`
- `src/analytics/events.py`
- `tests/analytics/test_events.py`
- `tests/api/test_activity_events.py`

**Files modified:**
- `src/config.py` (3 new settings)
- `src/api/app.py` (configure + lifespan wiring)
- `main.py` (configure)
- `src/cli/draftly.py` (configure + start/stop flusher)
- `src/api/routes/activity.py` (module-level `fetch_all` import + new `/events` endpoint)

---

### Task 1: Migration 014 — `agent_events` table

**Files:**
- Create: `infrastructure/cockroachdb/migrations/014_add_agent_events.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Migration 014: Structured agent event capture for dashboard telemetry

CREATE TABLE IF NOT EXISTS agent_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id STRING REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
    workflow_id STRING,
    event_type STRING NOT NULL,
    level STRING NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_org_created ON agent_events (org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_events_workflow ON agent_events (workflow_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_type_created ON agent_events (event_type, created_at);
```

Notes: `org_id`/`workflow_id` are nullable — system-level events (e.g. `discord_gateway_connected`, `cspann_index_created`) carry no org. Modeled on migration 013 (`013_loop_engineering.sql`).

- [ ] **Step 2: Commit**

```bash
git add infrastructure/cockroachdb/migrations/014_add_agent_events.sql
git commit -m "feat: add migration 014 for agent event capture"
```

---

### Task 2: Config settings for event capture

**Files:**
- Modify: `src/config.py:59-63` (after the Hill-climbing section)

- [ ] **Step 1: Add settings**

```python
    # Event capture (dashboard telemetry)
    event_capture_enabled: bool = True
    event_flush_interval_seconds: float = 5.0
    event_buffer_size: int = 500
```

- [ ] **Step 2: Verify import**

Run: `uv run python -c "from src.config import settings; print(settings.event_flush_interval_seconds)"`
Expected: `5.0`

- [ ] **Step 3: Commit**

```bash
git add src/config.py
git commit -m "feat: add event capture settings"
```

---

### Task 3: `EventCollector` processor + buffer (TDD)

**Files:**
- Test: `tests/analytics/test_events.py` (create)
- Create: `src/analytics/events.py`

- [ ] **Step 1: Write the failing processor tests**

```python
from unittest.mock import AsyncMock, patch

import pytest

from src.analytics.events import EventCollector


def make_collector() -> EventCollector:
    return EventCollector(max_buffer_size=10)


def test_processor_buffers_event():
    collector = make_collector()
    event_dict = {
        "event": "ingest_hybrid_started",
        "level": "info",
        "org_id": "org-1",
        "workflow_id": "w1",
        "question": "How?",
    }
    returned = collector.processor(None, "info", event_dict)

    assert returned is event_dict
    assert len(collector._buffer) == 1
    record = collector._buffer[0]
    assert record["event_type"] == "ingest_hybrid_started"
    assert record["level"] == "info"
    assert record["org_id"] == "org-1"
    assert record["workflow_id"] == "w1"
    assert record["details"] == {"question": "How?"}


def test_processor_strips_reserved_keys():
    collector = make_collector()
    collector.processor(
        None,
        "info",
        {
            "event": "e",
            "level": "info",
            "exc_info": ("exc", "inst", None),
            "logger": "x",
            "timestamp": "2026-07-31 00:00:00",
            "message": "hi",
        },
    )
    record = collector._buffer[0]
    assert record["details"] == {"message": "hi"}


def test_processor_truncates_long_strings():
    collector = make_collector()
    long = "x" * 5000
    collector.processor(None, "info", {"event": "e", "level": "info", "text_preview": long})
    record = collector._buffer[0]
    assert record["details"]["text_preview"].endswith("...[truncated]")
    assert len(record["details"]["text_preview"]) < 5000


def test_processor_drops_oversized_details():
    collector = make_collector()
    big = {"k%d" % i: "v" * 2000 for i in range(100)}
    collector.processor(None, "info", {"event": "e", "level": "info", **big})
    record = collector._buffer[0]
    assert record["details"].get("dropped") is True


@pytest.mark.asyncio
async def test_processor_respects_capture_disabled():
    collector = make_collector()
    with patch("src.analytics.events.settings") as mock_settings:
        mock_settings.event_capture_enabled = False
        collector.processor(None, "info", {"event": "e", "level": "info"})
    assert len(collector._buffer) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/analytics/test_events.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.analytics.events'`

- [ ] **Step 3: Implement `EventCollector` in `src/analytics/events.py`**

```python
"""Structured agent event capture — feeds dashboard telemetry.

A structlog processor snapshots every structured log event into an
in-memory buffer; a background asyncio task drains the buffer into the
``agent_events`` table in batches. The pipeline never blocks on or fails
because of analytics — capture is best-effort, fire-and-forget telemetry.
"""
from __future__ import annotations

import json
from collections import deque
from typing import Any

from src.config import settings

_MAX_STRING_LEN = 2000
_MAX_DETAILS_BYTES = 50_000
_RESERVED_KEYS = {"logger", "timestamp", "exc_info", "stack_info", "record"}


def _as_optional_str(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


class EventCollector:
    """Buffers structured log events for batched persistence.

    ``processor`` runs synchronously inside structlog (potentially on any
    thread); ``flush`` runs on the event loop. ``deque.append``/``clear``
    are atomic in CPython, so no lock is needed for telemetry.
    """

    def __init__(self, max_buffer_size: int = 500) -> None:
        self._buffer: deque[dict[str, Any]] = deque(maxlen=max_buffer_size)
        self._dropped = 0

    def processor(
        self,
        _logger: Any,
        _method_name: str,
        event_dict: dict[str, Any],
    ) -> dict[str, Any]:
        """structlog processor: snapshot each event before rendering."""
        if settings.event_capture_enabled:
            self._buffer.append(self._build_record(dict(event_dict)))
        return event_dict

    def _build_record(self, event_dict: dict[str, Any]) -> dict[str, Any]:
        org_id = _as_optional_str(event_dict.pop("org_id", None))
        workflow_id = _as_optional_str(event_dict.pop("workflow_id", None))
        event_type = str(event_dict.pop("event", "unknown"))
        level = str(event_dict.pop("level", "info"))
        details = self._sanitize(
            {key: value for key, value in event_dict.items() if key not in _RESERVED_KEYS}
        )
        if len(json.dumps(details, default=str)) > _MAX_DETAILS_BYTES:
            self._dropped += 1
            return {
                "org_id": org_id,
                "workflow_id": workflow_id,
                "event_type": event_type,
                "level": level,
                "details": {"dropped": True, "reason": "details_too_large"},
            }
        return {
            "org_id": org_id,
            "workflow_id": workflow_id,
            "event_type": event_type,
            "level": level,
            "details": details,
        }

    def _sanitize(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {key: self._sanitize(item) for key, item in value.items()}
        if isinstance(value, (list, tuple)):
            return [self._sanitize(item) for item in value]
        if isinstance(value, str) and len(value) > _MAX_STRING_LEN:
            return value[:_MAX_STRING_LEN] + "...[truncated]"
        return value
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/analytics/test_events.py -v`
Expected: 6 PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/events.py tests/analytics/test_events.py
git commit -m "feat: add EventCollector structlog processor with buffering"
```

---

### Task 4: Flush + batch persistence (TDD)

**Files:**
- Modify: `src/analytics/events.py` (add `flush` method + `_store_events`)
- Modify: `tests/analytics/test_events.py`

- [ ] **Step 1: Write the failing flush tests**

Append to `tests/analytics/test_events.py`:

```python
@pytest.mark.asyncio
async def test_flush_stores_buffered_events():
    collector = make_collector()
    collector.processor(None, "info", {"event": "e1", "level": "info", "org_id": "org-1"})
    collector.processor(None, "error", {"event": "e2", "level": "error"})

    with patch("src.analytics.events._store_events", new_callable=AsyncMock) as mock_store:
        count = await collector.flush()

    assert count == 2
    mock_store.assert_awaited_once()
    events = mock_store.await_args.args[0]
    assert [e["event_type"] for e in events] == ["e1", "e2"]
    assert len(collector._buffer) == 0


@pytest.mark.asyncio
async def test_flush_empty_buffer():
    collector = make_collector()
    with patch("src.analytics.events._store_events", new_callable=AsyncMock) as mock_store:
        count = await collector.flush()
    assert count == 0
    mock_store.assert_not_awaited()


@pytest.mark.asyncio
async def test_flush_error_does_not_raise():
    collector = make_collector()
    collector.processor(None, "info", {"event": "e1", "level": "info"})
    with patch("src.analytics.events._store_events", side_effect=Exception("DB down")):
        count = await collector.flush()
    assert count == 0
    assert len(collector._buffer) == 0


@pytest.mark.asyncio
async def test_store_events_uses_executemany():
    from src.analytics.events import _store_events

    pool = AsyncMock()
    with patch("src.analytics.events.get_pool", new_callable=AsyncMock, return_value=pool):
        await _store_events(
            [
                {
                    "org_id": "org-1",
                    "workflow_id": None,
                    "event_type": "e1",
                    "level": "info",
                    "details": {"a": 1},
                }
            ]
        )
    pool.executemany.assert_awaited_once()
    rows = pool.executemany.await_args.args[1]
    assert rows[0][0] == "org-1"
    assert rows[0][4] == '{"a": 1}'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/analytics/test_events.py -v`
Expected: 4 FAIL (`AttributeError: 'EventCollector' object has no attribute 'flush'` / `NameError: _store_events`)

- [ ] **Step 3: Implement `flush` and `_store_events`**

Add to `src/analytics/events.py` (import `structlog` and `get_pool`):

```python
import structlog

from src.config import settings
from src.database import get_pool
```

Add to the `EventCollector` class (after `_sanitize`):

```python
    async def flush(self) -> int:
        """Persist buffered events; never raises."""
        if not self._buffer:
            return 0
        events = list(self._buffer)
        self._buffer.clear()
        try:
            await _store_events(events)
        except Exception as e:
            logger.error("event_flush_failed", error=str(e), count=len(events))
            return 0
        logger.info("events_flushed", count=len(events))
        return len(events)
```

Add at module level (after `_RESERVED_KEYS`):

```python
logger = structlog.get_logger()
```

Add at module level (after the `EventCollector` class):

```python
async def _store_events(events: list[dict[str, Any]]) -> None:
    pool = await get_pool()
    await pool.executemany(
        """
        INSERT INTO agent_events (org_id, workflow_id, event_type, level, details)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        """,
        [
            (
                event["org_id"],
                event["workflow_id"],
                event["event_type"],
                event["level"],
                json.dumps(event["details"], default=str),
            )
            for event in events
        ],
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/analytics/test_events.py -v`
Expected: 10 PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/events.py tests/analytics/test_events.py
git commit -m "feat: add batched async flush for agent events"
```

---

### Task 5: `configure_logging` + flusher lifecycle (TDD)

**Files:**
- Modify: `src/analytics/events.py`
- Modify: `tests/analytics/test_events.py`

- [ ] **Step 1: Write the failing lifecycle tests**

Append to `tests/analytics/test_events.py`:

```python
def test_configure_logging_installs_processor():
    import structlog

    from src.analytics import events as events_module

    events_module.configure_logging()
    processors = structlog.get_config()["processors"]
    assert processors[-2] == events_module.collector.processor
    assert isinstance(processors[-1], structlog.dev.ConsoleRenderer)


@pytest.mark.asyncio
async def test_start_flusher_idempotent():
    from src.analytics import events as events_module

    await events_module.stop_flusher()
    await events_module.start_flusher()
    first = events_module._flush_task
    assert first is not None
    await events_module.start_flusher()
    assert events_module._flush_task is first
    await events_module.stop_flusher()
    assert events_module._flush_task is None


@pytest.mark.asyncio
async def test_stop_flusher_flushes_pending():
    from src.analytics import events as events_module

    await events_module.stop_flusher()
    pending = EventCollector(max_buffer_size=10)
    pending.processor(None, "info", {"event": "e1", "level": "info"})

    with (
        patch.object(events_module, "collector", pending),
        patch("src.analytics.events._store_events", new_callable=AsyncMock) as mock_store,
    ):
        await events_module.stop_flusher()

    mock_store.assert_awaited_once()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/analytics/test_events.py -v`
Expected: 3 FAIL (`NameError: name 'configure_logging' is not defined`, `_flush_task` not defined)

- [ ] **Step 3: Implement `configure_logging`, singleton, and flusher**

Add to `src/analytics/events.py` (import `asyncio`; keep `structlog`):

```python
import asyncio
```

Add at module level (after `_store_events`):

```python
collector = EventCollector(max_buffer_size=settings.event_buffer_size)
_flush_task: asyncio.Task[None] | None = None


def configure_logging() -> None:
    """Configure structlog to snapshot every structured event into the collector.

    Replicates structlog's built-in defaults and inserts ``collector.processor``
    between timestamps and rendering. Must run before the first log call.
    """
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,  # structlog>=26: lives in structlog.dev
            structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S", utc=False),
            collector.processor,
            structlog.dev.ConsoleRenderer(colors=False),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(0),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


async def _flush_loop(interval_seconds: float) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        await collector.flush()


async def start_flusher() -> None:
    """Start the background drain task (idempotent)."""
    global _flush_task
    if _flush_task is not None:
        return
    _flush_task = asyncio.create_task(_flush_loop(settings.event_flush_interval_seconds))


async def stop_flusher() -> None:
    """Cancel the background drain task and flush whatever remains."""
    global _flush_task
    if _flush_task is not None:
        _flush_task.cancel()
        try:
            await _flush_task
        except asyncio.CancelledError:
            pass
        _flush_task = None
    await collector.flush()
```

Note: `_store_events` references `logger` and `get_pool` (Task 4); `collector` is created after `_store_events` but `configure_logging`/flusher reference it only at call time — ordering is safe.

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/analytics/test_events.py -v`
Expected: 13 PASS

- [ ] **Step 5: Run ruff + mypy**

Run: `uv run ruff check src/analytics/events.py && uv run mypy src/analytics/events.py`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/analytics/events.py tests/analytics/test_events.py
git commit -m "feat: add structlog event sink config and background flusher"
```

---

### Task 6: Wire into entrypoints

**Files:**
- Modify: `src/api/app.py` (imports, lifespan)
- Modify: `main.py`
- Modify: `src/cli/draftly.py`

- [ ] **Step 1: Wire `src/api/app.py`**

After the `from src.api.routes import (...)` block (`src/api/app.py:11-25`), add:

```python
from src.analytics.events import configure_logging, start_flusher, stop_flusher

configure_logging()
```

In the `lifespan` async generator (`src/api/app.py:28-72`), after `await get_pool()` (currently line 38), add:

```python
    await get_pool()
    await start_flusher()
```

Before `await close_pool()` at the end of the lifespan (currently line 72), after the `if discord_task:` block, add:

```python
    # Flush remaining events on shutdown
    await stop_flusher()
```

- [ ] **Step 2: Wire `main.py`**

After the existing imports, add:

```python
from src.analytics.events import configure_logging

configure_logging()
```

- [ ] **Step 3: Wire `src/cli/draftly.py`**

Add to imports:

```python
from src.analytics.events import configure_logging, start_flusher, stop_flusher
```

After `logger = structlog.get_logger()`, add:

```python
configure_logging()
```

In `run_workflow`, after `await get_pool()` add `await start_flusher()`, and before the final `await close_pool()` add `await stop_flusher()` (so CLI runs flush captured events on completion):

```python
    await get_pool()
    await start_flusher()
```
```python
    await stop_flusher()
    await close_pool()
    return result
```

- [ ] **Step 4: Verify the app boots and captures events**

Run: `uv run uvicorn src.api.app:app --port 8001`
Expected: boot logs identical to before (`slack_socket_mode_enabled`, `cockroachdb_pool_created`, `discord_gateway_connected`, …) — the processor must not alter console output.

Then trigger one pipeline (a real Discord message, or `uv run python -m src.cli.draftly "question" --org-id <org>`), wait ~6 seconds, and query:

```bash
uv run python -c "
import asyncio, asyncpg, os
async def q():
    conn = await asyncpg.connect(os.environ['COCKROACHDB_URL'])
    rows = await conn.fetch('SELECT event_type, level, created_at FROM agent_events ORDER BY created_at DESC LIMIT 10')
    await conn.close()
    for r in rows: print(r['created_at'], r['level'], r['event_type'])
asyncio.run(q())
"
```

Expected: rows such as `ingest_hybrid_started`, `memory_retrieve_started`, `research_hybrid_started`, `llm_call`, `rubric_evaluation` — matching the terminal events.

- [ ] **Step 5: Commit**

```bash
git add src/api/app.py main.py src/cli/draftly.py
git commit -m "feat: wire agent event sink into server and CLI entrypoints"
```

---

### Task 7: Read endpoint `GET /api/activity/events` (TDD)

**Files:**
- Modify: `src/api/routes/activity.py`
- Test: `tests/api/test_activity_events.py` (create)

- [ ] **Step 1: Write the failing endpoint tests**

```python
"""Tests for GET /api/activity/events telemetry endpoint."""
from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_get_agent_events_returns_rows():
    from src.api.routes.activity import get_agent_events

    mock_token = {"org_id": "org-1"}
    rows = [
        {
            "event_type": "ingest_hybrid_started",
            "level": "info",
            "details": {"question": "How?"},
            "created_at": datetime(2026, 7, 31, 4, 22, 45),
        }
    ]
    with patch(
        "src.api.routes.activity.fetch_all", new_callable=AsyncMock, return_value=rows
    ):
        result = await get_agent_events(limit=50, token=mock_token)

    assert len(result) == 1
    assert result[0]["event_type"] == "ingest_hybrid_started"
    assert result[0]["level"] == "info"
    assert result[0]["details"] == {"question": "How?"}
    assert result[0]["created_at"].startswith("2026-07-31")


@pytest.mark.asyncio
async def test_get_agent_events_no_org():
    from src.api.routes.activity import get_agent_events

    with patch("src.api.routes.activity.fetch_all", new_callable=AsyncMock) as mock_fetch:
        result = await get_agent_events(limit=50, token={})
    assert result == []
    mock_fetch.assert_not_awaited()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/api/test_activity_events.py -v`
Expected: FAIL — `get_agent_events` not defined / `src.api.routes.activity.fetch_all` attribute missing.

- [ ] **Step 3: Modify `src/api/routes/activity.py`**

Add a module-level import (after `from src.api.auth import get_verified_token`):

```python
from src.database import fetch_all
```

Remove the two lazy `from src.database import fetch_all` lines (currently at `activity.py:17` and `activity.py:46`) — they're now redundant.

Add the endpoint after `get_latest_activity` (before `_serialize_activity`):

```python
@router.get("/events")
async def get_agent_events(
    limit: int = Query(50, ge=1, le=200),
    token: dict = Depends(get_verified_token),
):
    org_id = token.get("org_id")
    if not org_id:
        return []

    rows = await fetch_all(
        """
        SELECT event_type, level, details, created_at
        FROM agent_events
        WHERE org_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        org_id,
        limit,
    )
    return [
        {
            "event_type": row["event_type"],
            "level": row["level"],
            "details": row["details"] if isinstance(row["details"], dict) else {},
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
        for row in rows
    ]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/api/test_activity_events.py tests/analytics/test_events.py -v`
Expected: 15 PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/activity.py tests/api/test_activity_events.py
git commit -m "feat: expose agent event telemetry via GET /api/activity/events"
```

---

### Task 8: Apply migration + full verification

**Files:** none (ops)

- [ ] **Step 1: Apply migration 014 to the configured CockroachDB**

Run (uses the same `COCKROACHDB_URL` as the app — Cloud cluster or local docker on `:26258`):

```bash
uv run python - <<'PY'
import asyncio
import asyncpg
import os

async def main() -> None:
    conn = await asyncpg.connect(os.environ["COCKROACHDB_URL"])
    try:
        await conn.execute(
            open("infrastructure/cockroachdb/migrations/014_add_agent_events.sql").read()
        )
        print("migration 014 applied")
    finally:
        await conn.close()

asyncio.run(main())
PY
```
Expected: `migration 014 applied`

- [ ] **Step 2: Verify the table exists**

Run:
```bash
uv run python -c "
import asyncio, asyncpg, os
async def v():
    conn = await asyncpg.connect(os.environ['COCKROACHDB_URL'])
    tables = await conn.fetch(\"SELECT table_name FROM information_schema.tables WHERE table_schema='public'\")
    await conn.close()
    print('agent_events' in [t['table_name'] for t in tables])
asyncio.run(v())
"
```
Expected: `True`

- [ ] **Step 3: Full test suite**

Run: `uv run pytest`
Expected: all pass (existing + 15 new)

- [ ] **Step 4: Lint and typecheck**

Run: `uv run ruff check src/` then `uv run mypy src/`
Expected: no errors

- [ ] **Step 5: Commit any stragglers and final commit**

```bash
git status
git commit -m "chore: verify agent event sink end to end"
```

---

## Follow-ups (out of scope, recommended)

1. **Frontend wiring**: connect `frontend/src/components/LogStream.tsx` (currently static `DEFAULT_LOGS`) to `GET /api/activity/events` — that's the dashboard-facing payoff.
2. **Retention job**: daily purge of `agent_events` older than N days (mirror `settings.trace_retention_days`).
3. **Option B (trace enrichment)**: populate `rubric_results`/`verification_results`/`human_decisions`/`metadata` on `AgentTrace` in `collect_trace_node` for the Improvements analyzer.
