# Hill-Climbing Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the outermost hill-climbing loop — a self-improvement meta-loop that collects execution traces, analyzes them with an LLM, generates improvement proposals for prompts/rubrics/tools, and applies them after human approval.

**Architecture:** Five new tables (`agent_traces`, `harness_improvements`, `prompt_versions`, `rubric_versions`, `tool_configs`) store trace data and config. A `TraceCollector` buffers execution traces and flushes to CockroachDB. When the buffer threshold is reached, a `HillClimber` orchestrator fetches traces, runs LLM analysis, generates improvement proposals, and stores them for human review via API endpoints. Graph nodes are instrumented with timing wrappers. Prompts/rubrics/tools become DB-backed with LRU caching for hot-reload.

**Tech Stack:** asyncpg, LangGraph, FastAPI, Requesty-routed LLM calls

---

## File Structure

### New files
- `infrastructure/cockroachdb/migrations/013_loop_engineering.sql` — 5 new tables
- `src/analytics/__init__.py` — package export
- `src/analytics/traces.py` — AgentTrace/NodeTrace dataclasses, TraceCollector
- `src/analytics/analyzer.py` — LLM-based trace analysis
- `src/analytics/improver.py` — improvement generation, proposal management, config loading
- `src/analytics/hill_climber.py` — orchestrator
- `src/api/routes/improvements.py` — API endpoints for human review
- `tests/analytics/__init__.py` — test package
- `tests/analytics/test_traces.py` — tests for trace dataclasses and collector
- `tests/analytics/test_analyzer.py` — tests for analyzer
- `tests/analytics/test_improver.py` — tests for improver
- `tests/analytics/test_hill_climber.py` — tests for orchestrator

### Modified files
- `src/config.py` — add hill-climbing settings
- `src/agents/state.py` — add `_node_traces` and `_trace_collected` fields
- `src/agents/graph.py` — wrap nodes with timing, add collector node
- `src/api/app.py` — register improvements router, init analytics in lifespan

---

### Task 1: Create migration SQL

**Files:**
- Create: `infrastructure/cockroachdb/migrations/013_loop_engineering.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Migration 013: Loop Engineering — trace collection, improvement proposals, versioned config

-- Agent traces for hill-climbing analysis
CREATE TABLE IF NOT EXISTS agent_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id STRING NOT NULL,
    workflow_id STRING NOT NULL,
    trace_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_traces_org_created ON agent_traces (org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_traces_workflow ON agent_traces (workflow_id);

-- Harness improvement proposals
CREATE TABLE IF NOT EXISTS harness_improvements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id STRING NOT NULL,
    improvement_type STRING NOT NULL,
    proposed_changes JSONB NOT NULL,
    rationale STRING,
    status STRING DEFAULT 'pending',
    reviewed_by STRING,
    reviewed_at TIMESTAMPTZ,
    review_reason STRING,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_improvements_org_status ON harness_improvements (org_id, status);

-- Prompt versioning for A/B testing and improvement tracking
CREATE TABLE IF NOT EXISTS prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id STRING NOT NULL,
    node_name STRING NOT NULL,
    prompt_text STRING NOT NULL,
    version INT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    performance_score FLOAT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompts_org_node ON prompt_versions (org_id, node_name);

-- Rubric versioning
CREATE TABLE IF NOT EXISTS rubric_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id STRING NOT NULL,
    criterion_name STRING NOT NULL,
    criterion_text STRING NOT NULL,
    version INT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    performance_score FLOAT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rubrics_org_criterion ON rubric_versions (org_id, criterion_name);

-- Tool configurations for dynamic registration
CREATE TABLE IF NOT EXISTS tool_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id STRING NOT NULL,
    name STRING NOT NULL,
    description STRING NOT NULL,
    implementation_type STRING NOT NULL,
    config JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_configs_org_name ON tool_configs (org_id, name);
```

- [ ] **Step 2: Commit**

```bash
git add infrastructure/cockroachdb/migrations/013_loop_engineering.sql
git commit -m "feat: add migration 013 for loop engineering tables"
```

---

### Task 2: Add config settings

**Files:**
- Modify: `src/config.py` (after line 57)

- [ ] **Step 1: Add hill-climbing and verification settings**

Add after line 57 (`rubric_max_iterations: int = 3`):

```python
    # Hill-climbing (Loop 4)
    analysis_model: str = "tensorx/deepseek-v4-flash"
    trace_analysis_interval: int = 100
    auto_apply_improvements: bool = False
    trace_retention_days: int = 90

    # Verification
    deterministic_verification_enabled: bool = True
    max_verification_issues_per_type: int = 10
```

- [ ] **Step 2: Commit**

```bash
git add src/config.py
git commit -m "feat: add hill-climbing and verification config settings"
```

---

### Task 3: Create trace dataclasses

**Files:**
- Create: `src/analytics/__init__.py`
- Create: `src/analytics/traces.py`
- Create: `tests/analytics/__init__.py`
- Create: `tests/analytics/test_traces.py`

- [ ] **Step 1: Create package `__init__.py`**

```python
from src.analytics.traces import AgentTrace, NodeTrace, TraceCollector

__all__ = ["AgentTrace", "NodeTrace", "TraceCollector"]
```

- [ ] **Step 2: Write trace dataclasses and collector**

```python
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

import structlog

from src.database import execute, fetch_all

logger = structlog.get_logger()


@dataclass
class NodeTrace:
    node_name: str
    start_time: datetime
    end_time: datetime | None = None
    duration_ms: float = 0.0
    input_state: dict | None = None
    output_state: dict | None = None
    error: str | None = None


@dataclass
class AgentTrace:
    trace_id: str
    org_id: str
    workflow_id: str
    question: str
    question_type: str
    source: str
    nodes_executed: list[str] = field(default_factory=list)
    node_traces: list[NodeTrace] = field(default_factory=list)
    total_duration_ms: float = 0.0
    rubric_results: list[dict] = field(default_factory=list)
    verification_results: list[dict] = field(default_factory=list)
    human_decisions: list[dict] = field(default_factory=list)
    final_confidence: float = 0.0
    published: bool = False
    publish_urls: list[dict] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: dict = field(default_factory=dict)


class TraceCollector:
    def __init__(self, flush_threshold: int = 100):
        self._buffer: list[AgentTrace] = []
        self._flush_threshold = flush_threshold
        self._on_flush_callback = None

    def set_on_flush_callback(self, callback):
        self._on_flush_callback = callback

    async def collect(self, trace: AgentTrace) -> None:
        self._buffer.append(trace)
        if len(self._buffer) >= self._flush_threshold:
            await self.flush()

    async def flush(self) -> None:
        if not self._buffer:
            return
        traces = self._buffer.copy()
        self._buffer.clear()
        try:
            await _store_traces(traces)
            logger.info("traces_flushed", count=len(traces))
            if self._on_flush_callback:
                await self._on_flush_callback()
        except Exception as e:
            logger.error("trace_flush_failed", error=str(e))

    async def get_traces_for_analysis(
        self,
        org_id: str,
        time_window: timedelta | None = None,
        min_confidence: float = 0.0,
        max_confidence: float = 1.0,
    ) -> list[AgentTrace]:
        rows = await fetch_all(
            """
            SELECT trace_data, created_at
            FROM agent_traces
            WHERE org_id = $1
              AND trace_data->>'final_confidence'::FLOAT >= $2
              AND trace_data->>'final_confidence'::FLOAT <= $3
              AND ($4::TIMESTAMPTZ IS NULL OR created_at >= $4)
            ORDER BY created_at DESC
            """,
            org_id,
            min_confidence,
            max_confidence,
            datetime.utcnow() - time_window if time_window else None,
        )
        return [_dict_to_trace(row["trace_data"]) for row in rows]


def _truncate_state(state: dict, max_len: int = 200) -> dict:
    return {k: str(v)[:max_len] for k, v in state.items()}


async def _store_traces(traces: list[AgentTrace]) -> None:
    for trace in traces:
        await execute(
            """
            INSERT INTO agent_traces (id, org_id, workflow_id, trace_data, created_at)
            VALUES ($1, $2, $3, $4, $5)
            """,
            trace.trace_id,
            trace.org_id,
            trace.workflow_id,
            json.dumps({
                "question": trace.question,
                "question_type": trace.question_type,
                "source": trace.source,
                "nodes_executed": trace.nodes_executed,
                "node_traces": [
                    {
                        "node_name": nt.node_name,
                        "duration_ms": nt.duration_ms,
                        "error": nt.error,
                    }
                    for nt in trace.node_traces
                ],
                "total_duration_ms": trace.total_duration_ms,
                "rubric_results": trace.rubric_results,
                "verification_results": trace.verification_results,
                "human_decisions": trace.human_decisions,
                "final_confidence": trace.final_confidence,
                "published": trace.published,
                "publish_urls": trace.publish_urls,
                "metadata": trace.metadata,
            }, default=str),
            trace.timestamp,
        )


def _dict_to_trace(data: dict) -> AgentTrace:
    node_traces = [
        NodeTrace(
            node_name=nt["node_name"],
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow(),
            duration_ms=nt.get("duration_ms", 0),
            error=nt.get("error"),
        )
        for nt in data.get("node_traces", [])
    ]
    return AgentTrace(
        trace_id=data.get("trace_id", ""),
        org_id=data.get("org_id", ""),
        workflow_id=data.get("workflow_id", ""),
        question=data.get("question", ""),
        question_type=data.get("question_type", "unknown"),
        source=data.get("source", "cli"),
        nodes_executed=data.get("nodes_executed", []),
        node_traces=node_traces,
        total_duration_ms=data.get("total_duration_ms", 0),
        rubric_results=data.get("rubric_results", []),
        verification_results=data.get("verification_results", []),
        human_decisions=data.get("human_decisions", []),
        final_confidence=data.get("final_confidence", 0),
        published=data.get("published", False),
        publish_urls=data.get("publish_urls", []),
    )
```

- [ ] **Step 3: Write tests for trace dataclasses and collector**

```python
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest

from src.analytics.traces import AgentTrace, NodeTrace, TraceCollector


def test_node_trace_defaults():
    trace = NodeTrace(node_name="research", start_time=datetime.utcnow())
    assert trace.node_name == "research"
    assert trace.duration_ms == 0.0
    assert trace.error is None


def test_agent_trace_defaults():
    trace = AgentTrace(
        trace_id="t1",
        org_id="org1",
        workflow_id="w1",
        question="How to deploy?",
        question_type="simple",
        source="cli",
    )
    assert trace.trace_id == "t1"
    assert trace.nodes_executed == []
    assert trace.final_confidence == 0.0
    assert trace.published is False


def test_collector_buffers_and_flushes():
    collector = TraceCollector(flush_threshold=2)
    assert len(collector._buffer) == 0

    t1 = AgentTrace(trace_id="t1", org_id="o1", workflow_id="w1", question="q", question_type="s", source="cli")
    t2 = AgentTrace(trace_id="t2", org_id="o1", workflow_id="w1", question="q", question_type="s", source="cli")

    # First trace doesn't trigger flush
    collector.collect(t1)
    assert len(collector._buffer) == 1

    # Need async context for the actual flush, so we just check threshold logic
    assert len(collector._buffer) >= collector._flush_threshold is False


@pytest.mark.asyncio
async def test_collector_flush_calls_storage():
    collector = TraceCollector(flush_threshold=1)
    with patch("src.analytics.traces._store_traces", new_callable=AsyncMock) as mock_store:
        trace = AgentTrace(
            trace_id="t1", org_id="o1", workflow_id="w1",
            question="q", question_type="s", source="cli",
        )
        await collector.collect(trace)
        mock_store.assert_awaited_once()
        assert len(collector._buffer) == 0


@pytest.mark.asyncio
async def test_collector_flush_empty_buffer():
    collector = TraceCollector()
    with patch("src.analytics.traces._store_traces", new_callable=AsyncMock) as mock_store:
        await collector.flush()
        mock_store.assert_not_awaited()


@pytest.mark.asyncio
async def test_collector_on_flush_callback():
    callback = AsyncMock()
    collector = TraceCollector(flush_threshold=1)
    collector.set_on_flush_callback(callback)
    with patch("src.analytics.traces._store_traces", new_callable=AsyncMock):
        trace = AgentTrace(
            trace_id="t1", org_id="o1", workflow_id="w1",
            question="q", question_type="s", source="cli",
        )
        await collector.collect(trace)
        callback.assert_awaited_once()


@pytest.mark.asyncio
async def test_collector_flush_error_does_not_raise():
    collector = TraceCollector(flush_threshold=1)
    with patch("src.analytics.traces._store_traces", side_effect=Exception("DB down")):
        trace = AgentTrace(
            trace_id="t1", org_id="o1", workflow_id="w1",
            question="q", question_type="s", source="cli",
        )
        # Should not raise
        await collector.collect(trace)


def test_truncate_state():
    from src.analytics.traces import _truncate_state
    state = {"key": "x" * 500}
    result = _truncate_state(state, max_len=10)
    assert len(result["key"]) == 10
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/analytics/test_traces.py -v`
Expected: all 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/analytics/ tests/analytics/
git commit -m "feat: add trace dataclasses and collector"
```

---

### Task 4: Add state fields and instrument graph

**Files:**
- Modify: `src/agents/state.py`
- Modify: `src/agents/graph.py`

- [ ] **Step 1: Add trace fields to `DocumentationState`**

Add at the end of `state.py`, before the closing of the TypedDict:

```python
    # Trace collection for hill-climbing
    _node_traces: list  # list[NodeTrace] — populated during execution
    _trace_collected: bool
```

- [ ] **Step 2: Instrument graph with node timing wrappers and collector node**

Rewrite `src/agents/graph.py`:

```python
from __future__ import annotations

import structlog
from datetime import datetime
from uuid import uuid4
from langgraph.graph import END, StateGraph

from src.agents.nodes.human import human_review_node
from src.agents.nodes.memory import memory_retrieve_node
from src.agents.nodes.publish import publish_node
from src.agents.nodes.synthesize import synthesize_node
from src.agents.nodes.write import write_docs_node
from src.agents.state import DocumentationState
from src.analytics.traces import AgentTrace, NodeTrace, TraceCollector

logger = structlog.get_logger()

_trace_collector: TraceCollector | None = None


def set_trace_collector(collector: TraceCollector) -> None:
    global _trace_collector
    _trace_collector = collector


async def collect_trace_node(state: DocumentationState) -> dict:
    """Collect final trace after pipeline completion."""
    global _trace_collector
    if _trace_collector is None:
        return {"_trace_collected": True}

    node_traces: list[NodeTrace] = state.get("_node_traces", []) or []
    try:
        trace = AgentTrace(
            trace_id=str(uuid4()),
            org_id=state["org_id"],
            workflow_id=state.get("workflow_id", ""),
            question=state["question"],
            question_type=state.get("question_type", "unknown"),
            source=state.get("source", "cli"),
            nodes_executed=[t.node_name for t in node_traces],
            node_traces=node_traces,
            total_duration_ms=sum(t.duration_ms for t in node_traces),
            rubric_results=[],
            verification_results=[],
            human_decisions=[],
            final_confidence=state.get("confidence_score", 0),
            published=bool(state.get("published_urls")),
            publish_urls=state.get("published_urls", []),
        )
        await _trace_collector.collect(trace)
    except Exception as e:
        logger.error("trace_collection_failed", error=str(e))

    return {"_trace_collected": True}


def _wrap_node_with_tracing(node_name: str, node_fn):
    """Wrap a graph node to capture timing and I/O snapshots."""
    async def traced_node(state: DocumentationState) -> dict:
        start_time = datetime.utcnow()
        error = None
        try:
            result = await node_fn(state)
            return result
        except Exception as e:
            error = str(e)
            raise
        finally:
            end_time = datetime.utcnow()
            duration_ms = (end_time - start_time).total_seconds() * 1000
            node_trace = NodeTrace(
                node_name=node_name,
                start_time=start_time,
                end_time=end_time,
                duration_ms=duration_ms,
                input_state={k: str(v)[:200] for k, v in state.items()},
                error=error,
            )
            # We store the trace on state via the returned dict -- but since exceptions
            # may skip the node return, we attach via the state reference directly.
            # We set a key on the mutable state dict that survives.
            if "_node_traces" not in state:
                state["_node_traces"] = []
            state["_node_traces"].append(node_trace)

    return traced_node


def build_hybrid_graph():
    """Build enhanced graph with Deep agents capabilities and trace collection."""
    from src.agents.nodes.ingest import ingest_node_hybrid
    from src.agents.nodes.research import research_node_hybrid
    from src.agents.nodes.review import ai_review_node_hybrid

    graph = StateGraph(DocumentationState)

    node_defs = {
        "ingest": ingest_node_hybrid,
        "memory_retrieve": memory_retrieve_node,
        "research": research_node_hybrid,
        "synthesize": synthesize_node,
        "write_docs": write_docs_node,
        "ai_review": ai_review_node_hybrid,
        "human_review": human_review_node,
        "publish": publish_node,
    }

    for name, fn in node_defs.items():
        graph.add_node(name, _wrap_node_with_tracing(name, fn))

    graph.add_node("collect_trace", collect_trace_node)

    graph.set_entry_point("ingest")
    graph.add_edge("ingest", "memory_retrieve")
    graph.add_edge("memory_retrieve", "research")
    graph.add_edge("research", "synthesize")
    graph.add_edge("synthesize", "write_docs")
    graph.add_edge("write_docs", "ai_review")

    graph.add_conditional_edges(
        "ai_review",
        lambda state: route_by_rubric(state),
        {
            "human_review": "human_review",
            "research": "research",
            "write_docs": "write_docs",
            "publish": "publish",
        },
    )

    graph.add_conditional_edges(
        "human_review",
        lambda state: {
            "approve": "publish",
            "approved": "publish",
            "reject": "collect_trace",
            "rejected": "collect_trace",
            "revise": "write_docs",
            "needs_changes": "write_docs",
        }.get(state.get("human_decision", ""), "collect_trace"),
    )

    graph.add_edge("publish", "collect_trace")
    graph.add_edge("collect_trace", END)

    logger.info("hybrid_graph_built_with_tracing")
    return graph


def route_by_rubric(state: DocumentationState) -> str:
    """Route based on rubric evaluation results. HITL is always required."""
    rubric_status = state.get("rubric_status", {})

    if rubric_status.get("needs_revision"):
        if rubric_status.get("research_needed"):
            return "research"
        return "write_docs"

    return "human_review"
```

- [ ] **Step 3: Commit**

```bash
git add src/agents/state.py src/agents/graph.py
git commit -m "feat: instrument graph with trace collection"
```

---

### Task 5: Startup prompt/rubric seeding

**Files:**
- Create: `src/analytics/seed.py`

- [ ] **Step 1: Create seeding logic to upsert current prompt/rubric constants on startup**

```python
from __future__ import annotations

import structlog

from src.database import execute, fetch_one

logger = structlog.get_logger()

# Reference the prompts we want to track — import paths may vary
_PROMPT_NODES = [
    "write_docs",
    "synthesize",
    "research",
    "ai_review",
    "ingest",
]

_RUBRIC_CRITERIA = [
    "Accuracy",
    "Completeness",
    "Clarity",
    "Code Accuracy",
    "Missing Steps",
]


async def seed_prompt_version(org_id: str, node_name: str, prompt_text: str) -> None:
    """Insert version 1 of a prompt if it doesn't exist for this org/node."""
    existing = await fetch_one(
        "SELECT id FROM prompt_versions WHERE org_id = $1 AND node_name = $2 AND version = 1",
        org_id,
        node_name,
    )
    if existing:
        return
    await execute(
        """
        INSERT INTO prompt_versions (org_id, node_name, prompt_text, version, is_active)
        VALUES ($1, $2, $3, 1, true)
        """,
        org_id,
        node_name,
        prompt_text,
    )
    logger.info("prompt_version_seeded", org_id=org_id, node_name=node_name, version=1)


async def seed_rubric_version(org_id: str, criterion_name: str, criterion_text: str) -> None:
    """Insert version 1 of a rubric criterion if it doesn't exist."""
    existing = await fetch_one(
        "SELECT id FROM rubric_versions WHERE org_id = $1 AND criterion_name = $2 AND version = 1",
        org_id,
        criterion_name,
    )
    if existing:
        return
    await execute(
        """
        INSERT INTO rubric_versions (org_id, criterion_name, criterion_text, version, is_active)
        VALUES ($1, $2, $3, 1, true)
        """,
        org_id,
        criterion_name,
        criterion_text,
    )
    logger.info("rubric_version_seeded", org_id=org_id, criterion_name=criterion_name, version=1)


async def seed_all_versions(org_id: str) -> None:
    """Seed all prompt and rubric versions for a given org."""
    for node in _PROMPT_NODES:
        await seed_prompt_version(org_id, node, f"Prompt for {node} (version 1)")

    for criterion in _RUBRIC_CRITERIA:
        await seed_rubric_version(org_id, criterion, f"Criterion: {criterion} (version 1)")

    logger.info("all_versions_seeded", org_id=org_id)
```

- [ ] **Step 2: Commit**

```bash
git add src/analytics/seed.py
git commit -m "feat: add startup seeding for prompt and rubric versions"
```

---

### Task 6: Create trace analyzer

**Files:**
- Create: `src/analytics/analyzer.py`
- Create: `tests/analytics/test_analyzer.py`

- [ ] **Step 1: Write the analyzer with LLM analysis**

```python
from __future__ import annotations

import json
import re
from typing import Any

import structlog

from src.analytics.traces import AgentTrace
from src.config import settings
from src.integrations.llm import call_llm

logger = structlog.get_logger()

ANALYSIS_PROMPT = """You are an agent performance analyst. Analyze these execution traces and identify improvement opportunities.

## Traces Summary
{traces_summary}

## Analysis Tasks

1. **Failure Pattern Analysis**
   - Identify common failure modes
   - Find nodes with highest error rates
   - Detect timeout patterns

2. **Quality Pattern Analysis**
   - Identify prompts that consistently produce low confidence
   - Find rubric criteria that frequently fail
   - Detect verification check patterns

3. **Performance Analysis**
   - Find bottleneck nodes (highest duration)
   - Identify parallelization opportunities
   - Detect resource waste

4. **Improvement Suggestions**
   - Specific prompt rewrites for underperforming nodes
   - New tool suggestions for research gaps
   - Rubric criteria adjustments

Return a JSON object with:
{{
    "failure_patterns": [{{"pattern": "string", "frequency": 0, "impact": "string"}}],
    "quality_patterns": [{{"pattern": "string", "frequency": 0, "suggestion": "string"}}],
    "performance_patterns": [{{"node": "string", "avg_duration_ms": 0.0, "optimization": "string"}}],
    "improvements": {{
        "prompts": [{{"node": "string", "current_issue": "string", "suggested_fix": "string", "rationale": "string"}}],
        "tools": [{{"gap": "string", "suggested_tool": "string", "rationale": "string"}}],
        "rubrics": [{{"criterion": "string", "issue": "string", "suggested_change": "string"}}]
    }},
    "confidence_trend": 0.0,
    "overall_health": "good" | "needs_attention" | "critical"
}}

Return ONLY valid JSON."""


def _summarize_traces(traces: list[AgentTrace]) -> str:
    if not traces:
        return "No traces available."

    total = len(traces)
    avg_confidence = sum(t.final_confidence for t in traces) / total
    publish_count = sum(1 for t in traces if t.published)
    node_stats: dict[str, dict] = {}

    for trace in traces:
        for nt in trace.node_traces:
            node = nt.node_name
            if node not in node_stats:
                node_stats[node] = {"count": 0, "total_duration_ms": 0, "errors": 0}
            node_stats[node]["count"] += 1
            node_stats[node]["total_duration_ms"] += nt.duration_ms
            if nt.error:
                node_stats[node]["errors"] += 1

    for stats in node_stats.values():
        stats["avg_duration_ms"] = stats["total_duration_ms"] / stats["count"] if stats["count"] else 0
        stats["error_rate"] = stats["errors"] / stats["count"] if stats["count"] else 0

    summary = {
        "total_traces": total,
        "avg_confidence": round(avg_confidence, 3),
        "publish_rate": round(publish_count / total, 3) if total else 0,
        "node_statistics": node_stats,
        "failure_summary": {
            "total_errors": sum(s["errors"] for s in node_stats.values()),
            "error_nodes": [n for n, s in node_stats.items() if s["errors"] > 0],
        },
    }
    return json.dumps(summary, indent=2, default=str)


async def analyze_production_traces(traces: list[AgentTrace]) -> dict[str, Any]:
    if not traces:
        return {"error": "no_traces", "overall_health": "unknown"}

    traces_summary = _summarize_traces(traces)

    try:
        response = await call_llm(
            prompt=ANALYSIS_PROMPT.format(traces_summary=traces_summary),
            system_prompt="You are an expert at analyzing AI agent performance. Be specific and actionable.",
            model=settings.analysis_model,
        )
        analysis = _parse_json_response(response)
    except Exception as e:
        logger.error("trace_analysis_failed", error=str(e))
        return {"error": str(e), "overall_health": "unknown"}

    analysis["metrics"] = {
        "total_traces": len(traces),
        "avg_confidence": sum(t.final_confidence for t in traces) / len(traces),
        "publish_ratio": sum(1 for t in traces if t.published) / len(traces),
    }
    return analysis


def _parse_json_response(response: str) -> dict:
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", response)
        if match:
            return json.loads(match.group())
        return {"error": "Failed to parse analysis response", "overall_health": "unknown"}
```

- [ ] **Step 2: Write analyzer tests**

```python
from unittest.mock import AsyncMock, patch

import pytest

from src.analytics.analyzer import (
    _summarize_traces,
    analyze_production_traces,
    _parse_json_response,
)
from src.analytics.traces import AgentTrace, NodeTrace


def make_trace(node_names: list[str], confidence: float = 0.8, published: bool = True):
    traces = [
        NodeTrace(node_name=n, start_time=None, duration_ms=100.0)
        for n in node_names
    ]
    return AgentTrace(
        trace_id="t1", org_id="o1", workflow_id="w1",
        question="q", question_type="simple", source="cli",
        node_traces=traces, final_confidence=confidence, published=published,
    )


def test_summarize_traces_empty():
    assert _summarize_traces([]) == "No traces available."


def test_summarize_traces_basic():
    traces = [make_trace(["research", "write_docs"], confidence=0.9, published=True)]
    summary = _summarize_traces(traces)
    assert "total_traces" in summary
    assert "research" in summary


def test_parse_json_response_direct():
    result = _parse_json_response('{"overall_health": "good"}')
    assert result["overall_health"] == "good"


def test_parse_json_response_with_markdown_fence():
    result = _parse_json_response('```json\n{"overall_health": "good"}\n```')
    assert result["overall_health"] == "good"


def test_parse_json_response_fallback():
    text = 'Some text before {"overall_health": "good"} some after'
    result = _parse_json_response(text)
    assert result["overall_health"] == "good"


def test_parse_json_response_invalid():
    result = _parse_json_response("not json at all")
    assert "error" in result


@pytest.mark.asyncio
async def test_analyze_empty_traces():
    result = await analyze_production_traces([])
    assert result["error"] == "no_traces"


@pytest.mark.asyncio
async def test_analyze_with_llm_response():
    traces = [make_trace(["research"], confidence=0.9)]
    mock_response = (
        '{"failure_patterns": [], "quality_patterns": [], '
        '"performance_patterns": [], "improvements": {}, '
        '"confidence_trend": 0.0, "overall_health": "good"}'
    )
    with patch("src.analytics.analyzer.call_llm", new_callable=AsyncMock, return_value=mock_response):
        result = await analyze_production_traces(traces)
        assert result["overall_health"] == "good"
        assert result["metrics"]["total_traces"] == 1


@pytest.mark.asyncio
async def test_analyze_llm_failure_fallback():
    traces = [make_trace(["research"], confidence=0.9)]
    with patch("src.analytics.analyzer.call_llm", side_effect=Exception("LLM down")):
        result = await analyze_production_traces(traces)
        assert result["overall_health"] == "unknown"
        assert "error" in result
```

- [ ] **Step 3: Run tests**

Run: `uv run pytest tests/analytics/test_analyzer.py -v`
Expected: all 8 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/analytics/analyzer.py tests/analytics/test_analyzer.py
git commit -m "feat: add trace analyzer with LLM-based analysis"
```

---

### Task 7: Create improver — improvement generation, proposals, config loading

**Files:**
- Create: `src/analytics/improver.py`
- Create: `tests/analytics/test_improver.py`

- [ ] **Step 1: Write the improver module**

```python
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4
from typing import Any

import structlog

from src.analytics.traces import TraceCollector
from src.config import settings
from src.database import execute, fetch_all, fetch_one
from src.integrations.llm import call_llm

logger = structlog.get_logger()

IMPROVEMENT_PROMPT = """Based on this analysis, generate specific improvements for the agent harness.

## Analysis
{analysis}

## Current Configuration
{current_config}

Generate improvements for:
1. **Prompt Improvements**: Rewrite underperforming prompts
2. **Tool Suggestions**: New tools to address research gaps
3. **Rubric Updates**: Adjust criteria based on failure patterns

Return a JSON object with:
{{
    "prompts": [
        {{"node": "string", "current_prompt": "string", "improved_prompt": "string", "rationale": "string"}}
    ],
    "tools": [
        {{"name": "string", "description": "string", "implementation_type": "http_get", "config": {{}}, "rationale": "string"}}
    ],
    "rubrics": [
        {{"criterion": "string", "current_text": "string", "improved_text": "string", "rationale": "string"}}
    ]
}}

Return ONLY valid JSON."""


@dataclass
class ImprovementProposal:
    id: str
    org_id: str
    improvement_type: str
    proposed_changes: dict
    rationale: str
    status: str = "pending"
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)


async def generate_improvements(analysis: dict, current_config: dict) -> dict:
    try:
        response = await call_llm(
            prompt=IMPROVEMENT_PROMPT.format(
                analysis=json.dumps(analysis, indent=2),
                current_config=json.dumps(current_config, indent=2),
            ),
            system_prompt="You are an expert at optimizing AI agent systems. Generate specific, actionable improvements.",
            model=settings.analysis_model,
        )
        return _parse_json_response(response)
    except Exception as e:
        logger.error("improvement_generation_failed", error=str(e))
        return {"error": str(e)}


async def create_improvement_proposals(org_id: str, improvements: dict) -> list[ImprovementProposal]:
    proposals = []

    for prompt_change in improvements.get("prompts", []):
        proposal = ImprovementProposal(
            id=str(uuid4()),
            org_id=org_id,
            improvement_type="prompt",
            proposed_changes=prompt_change,
            rationale=prompt_change.get("rationale", ""),
        )
        await _store_proposal(proposal)
        proposals.append(proposal)

    for tool in improvements.get("tools", []):
        proposal = ImprovementProposal(
            id=str(uuid4()),
            org_id=org_id,
            improvement_type="tool",
            proposed_changes=tool,
            rationale=tool.get("rationale", ""),
        )
        await _store_proposal(proposal)
        proposals.append(proposal)

    for rubric_change in improvements.get("rubrics", []):
        proposal = ImprovementProposal(
            id=str(uuid4()),
            org_id=org_id,
            improvement_type="rubric",
            proposed_changes=rubric_change,
            rationale=rubric_change.get("rationale", ""),
        )
        await _store_proposal(proposal)
        proposals.append(proposal)

    logger.info("improvement_proposals_created", org_id=org_id, count=len(proposals))
    return proposals


async def apply_improvement(proposal_id: str) -> bool:
    row = await fetch_one(
        "SELECT * FROM harness_improvements WHERE id = $1", proposal_id,
    )
    if not row:
        logger.error("proposal_not_found", proposal_id=proposal_id)
        return False

    proposal_data = row["proposed_changes"]
    imp_type = row["improvement_type"]
    org_id = row["org_id"]

    try:
        if imp_type == "prompt":
            node = proposal_data.get("node", "unknown")
            improved = proposal_data.get("improved_prompt", "")
            # Deactivate old active, insert new
            await execute(
                "UPDATE prompt_versions SET is_active = false WHERE org_id = $1 AND node_name = $2 AND is_active = true",
                org_id, node,
            )
            await execute(
                """
                INSERT INTO prompt_versions (org_id, node_name, prompt_text, version, is_active)
                SELECT $1, $2, $3, COALESCE(MAX(version), 0) + 1, true
                FROM prompt_versions WHERE org_id = $1 AND node_name = $2
                """,
                org_id, node, improved,
            )

        elif imp_type == "rubric":
            criterion = proposal_data.get("criterion", "unknown")
            improved = proposal_data.get("improved_text", "")
            await execute(
                "UPDATE rubric_versions SET is_active = false WHERE org_id = $1 AND criterion_name = $2 AND is_active = true",
                org_id, criterion,
            )
            await execute(
                """
                INSERT INTO rubric_versions (org_id, criterion_name, criterion_text, version, is_active)
                SELECT $1, $2, $3, COALESCE(MAX(version), 0) + 1, true
                FROM rubric_versions WHERE org_id = $1 AND criterion_name = $2
                """,
                org_id, criterion, improved,
            )

        elif imp_type == "tool":
            name = proposal_data.get("name", "unknown")
            await execute(
                """
                INSERT INTO tool_configs (org_id, name, description, implementation_type, config)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (org_id, name) DO UPDATE
                SET description = $3, config = $5, version = tool_configs.version + 1
                """,
                org_id,
                name,
                proposal_data.get("description", ""),
                proposal_data.get("implementation_type", "http_get"),
                json.dumps(proposal_data.get("config", {})),
            )

        await _update_proposal_status(proposal_id, "applied")
        logger.info("improvement_applied", proposal_id=proposal_id, imp_type=imp_type)
        return True

    except Exception as e:
        logger.error("improvement_apply_failed", proposal_id=proposal_id, error=str(e))
        await _update_proposal_status(proposal_id, "failed")
        return False


async def load_current_config(org_id: str) -> dict:
    prompts = await fetch_all(
        "SELECT node_name, prompt_text FROM prompt_versions WHERE org_id = $1 AND is_active = true",
        org_id,
    )
    rubrics = await fetch_all(
        "SELECT criterion_name, criterion_text FROM rubric_versions WHERE org_id = $1 AND is_active = true",
        org_id,
    )
    tools = await fetch_all(
        "SELECT name, description, implementation_type, config FROM tool_configs WHERE org_id = $1 AND enabled = true",
        org_id,
    )
    return {
        "prompts": {r["node_name"]: r["prompt_text"] for r in prompts},
        "rubrics": {r["criterion_name"]: r["criterion_text"] for r in rubrics},
        "tools": [
            {"name": t["name"], "description": t["description"],
             "type": t["implementation_type"], "config": t["config"]}
            for t in tools
        ],
    }


async def fetch_pending_proposals(org_id: str) -> list[dict]:
    rows = await fetch_all(
        "SELECT * FROM harness_improvements WHERE org_id = $1 AND status = 'pending' ORDER BY created_at DESC",
        org_id,
    )
    return [dict(r) for r in rows]


async def update_proposal_status(proposal_id: str, status: str, reviewed_by: str | None = None, reason: str = "") -> None:
    await _update_proposal_status(proposal_id, status, reviewed_by, reason)


async def _store_proposal(proposal: ImprovementProposal) -> None:
    await execute(
        """
        INSERT INTO harness_improvements (id, org_id, improvement_type, proposed_changes, rationale, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        proposal.id, proposal.org_id, proposal.improvement_type,
        json.dumps(proposal.proposed_changes),
        proposal.rationale, proposal.status,
    )


async def _update_proposal_status(proposal_id: str, status: str, reviewed_by: str | None = None, reason: str = "") -> None:
    await execute(
        """
        UPDATE harness_improvements
        SET status = $1, reviewed_by = $2, reviewed_at = now(), review_reason = $3
        WHERE id = $4
        """,
        status, reviewed_by or "", reason, proposal_id,
    )


def _parse_json_response(response: str) -> dict:
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", response)
        if match:
            return json.loads(match.group())
        return {"error": "Failed to parse response"}
```

- [ ] **Step 2: Write improver tests**

```python
from unittest.mock import AsyncMock, patch

import pytest

from src.analytics.improver import (
    ImprovementProposal,
    generate_improvements,
    create_improvement_proposals,
    _parse_json_response,
)


def test_improvement_proposal_defaults():
    p = ImprovementProposal(id="p1", org_id="o1", improvement_type="prompt", proposed_changes={}, rationale="test")
    assert p.status == "pending"
    assert p.reviewed_by is None


def test_parse_json_response_direct():
    result = _parse_json_response('{"prompts": []}')
    assert result["prompts"] == []


def test_parse_json_response_fallback():
    result = _parse_json_response('text {"prompts": []} text')
    assert result["prompts"] == []


def test_parse_json_response_invalid():
    result = _parse_json_response("garbage")
    assert "error" in result


@pytest.mark.asyncio
async def test_generate_improvements_llm_success():
    mock_response = '{"prompts": [], "tools": [], "rubrics": []}'
    with patch("src.analytics.improver.call_llm", new_callable=AsyncMock, return_value=mock_response):
        result = await generate_improvements({"metrics": {}}, {"prompts": {}})
        assert result["prompts"] == []


@pytest.mark.asyncio
async def test_generate_improvements_llm_failure():
    with patch("src.analytics.improver.call_llm", side_effect=Exception("LLM down")):
        result = await generate_improvements({"metrics": {}}, {"prompts": {}})
        assert "error" in result


@pytest.mark.asyncio
async def test_create_proposals_stores_to_db():
    improvements = {
        "prompts": [{"node": "write_docs", "improved_prompt": "new", "rationale": "better"}],
        "tools": [],
        "rubrics": [],
    }
    with patch("src.analytics.improver._store_proposal", new_callable=AsyncMock) as mock_store:
        proposals = await create_improvement_proposals("org1", improvements)
        assert len(proposals) == 1
        mock_store.assert_awaited_once()
```

- [ ] **Step 3: Run tests**

Run: `uv run pytest tests/analytics/test_improver.py -v`
Expected: all 6 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/analytics/improver.py tests/analytics/test_improver.py
git commit -m "feat: add improver with improvement generation, proposals, and config loading"
```

---

### Task 8: Create hill-climbing orchestrator

**Files:**
- Create: `src/analytics/hill_climber.py`
- Create: `tests/analytics/test_hill_climber.py`

- [ ] **Step 1: Write the hill-climber orchestrator**

```python
from __future__ import annotations

from datetime import timedelta

import structlog

from src.analytics.analyzer import analyze_production_traces
from src.analytics.improver import (
    create_improvement_proposals,
    generate_improvements,
    load_current_config,
)
from src.analytics.traces import TraceCollector

logger = structlog.get_logger()


class HillClimber:
    def __init__(
        self,
        trace_collector: TraceCollector,
        org_id: str,
        analysis_interval: int = 100,
    ):
        self.trace_collector = trace_collector
        self.org_id = org_id
        self.analysis_interval = analysis_interval
        self._trace_count = 0

    async def should_analyze(self) -> bool:
        self._trace_count += 1
        return self._trace_count >= self.analysis_interval

    async def run_analysis_cycle(self) -> dict:
        logger.info("hill_climbing_cycle_started", org_id=self.org_id)

        traces = await self.trace_collector.get_traces_for_analysis(
            org_id=self.org_id,
            time_window=timedelta(days=7),
        )

        if not traces:
            logger.info("no_traces_for_analysis", org_id=self.org_id)
            return {"status": "no_traces"}

        analysis = await analyze_production_traces(traces)
        if "error" in analysis and analysis.get("overall_health") == "unknown":
            logger.error("analysis_failed_skipping_improvements", org_id=self.org_id)
            return {"status": "analysis_failed", "analysis": analysis}

        current_config = await load_current_config(self.org_id)
        improvements = await generate_improvements(analysis, current_config)
        if "error" in improvements:
            logger.error("improvement_generation_failed", org_id=self.org_id)
            return {"status": "improvement_failed", "analysis": analysis}

        proposals = await create_improvement_proposals(self.org_id, improvements)

        logger.info(
            "hill_climbing_cycle_completed",
            org_id=self.org_id,
            traces_analyzed=len(traces),
            proposals_created=len(proposals),
        )

        return {
            "status": "completed",
            "traces_analyzed": len(traces),
            "proposals_created": len(proposals),
            "analysis": analysis,
        }
```

- [ ] **Step 2: Write hill-climber tests**

```python
from unittest.mock import AsyncMock, patch

import pytest

from src.analytics.hill_climber import HillClimber
from src.analytics.traces import TraceCollector, AgentTrace


def make_trace():
    return AgentTrace(
        trace_id="t1", org_id="o1", workflow_id="w1",
        question="q", question_type="simple", source="cli",
        final_confidence=0.9, published=True,
    )


@pytest.mark.asyncio
async def test_hill_climber_should_analyze_threshold():
    collector = TraceCollector()
    climber = HillClimber(collector, "org1", analysis_interval=3)
    assert await climber.should_analyze() is False
    assert await climber.should_analyze() is False
    assert await climber.should_analyze() is True
    assert await climber.should_analyze() is False  # resets after trigger


@pytest.mark.asyncio
async def test_hill_climber_cycle_no_traces():
    collector = TraceCollector()
    climber = HillClimber(collector, "org1")
    with patch.object(collector, "get_traces_for_analysis", new_callable=AsyncMock, return_value=[]):
        result = await climber.run_analysis_cycle()
        assert result["status"] == "no_traces"


@pytest.mark.asyncio
async def test_hill_climber_cycle_success():
    collector = TraceCollector()
    climber = HillClimber(collector, "org1")
    traces = [make_trace()]

    with (
        patch.object(collector, "get_traces_for_analysis", new_callable=AsyncMock, return_value=traces),
        patch("src.analytics.hill_climber.analyze_production_traces", new_callable=AsyncMock, return_value={
            "overall_health": "good", "metrics": {}, "failure_patterns": [],
        }),
        patch("src.analytics.hill_climber.load_current_config", new_callable=AsyncMock, return_value={}),
        patch("src.analytics.hill_climber.generate_improvements", new_callable=AsyncMock, return_value={"prompts": [], "tools": [], "rubrics": []}),
        patch("src.analytics.hill_climber.create_improvement_proposals", new_callable=AsyncMock, return_value=[]),
    ):
        result = await climber.run_analysis_cycle()
        assert result["status"] == "completed"
        assert result["traces_analyzed"] == 1
```

- [ ] **Step 3: Run tests**

Run: `uv run pytest tests/analytics/test_hill_climber.py -v`
Expected: all 3 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/analytics/hill_climber.py tests/analytics/test_hill_climber.py
git commit -m "feat: add hill-climbing orchestrator"
```

---

### Task 9: Create API endpoints for human review

**Files:**
- Create: `src/api/routes/improvements.py`

- [ ] **Step 1: Write the improvements API router**

```python
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from src.api.auth import get_verified_token
from src.analytics.improver import (
    apply_improvement,
    fetch_pending_proposals,
    load_current_config,
    update_proposal_status,
)

router = APIRouter()


@router.get("/improvements/pending")
async def get_pending_improvements(
    org_id: str,
    token: dict = Depends(get_verified_token),
):
    proposals = await fetch_pending_proposals(org_id)
    return {"proposals": proposals}


@router.get("/improvements/{proposal_id}")
async def get_improvement(
    proposal_id: str,
    token: dict = Depends(get_verified_token),
):
    proposals = await fetch_pending_proposals("")
    # Filter by ID — fetch_pending_proposals returns all for org, but we need direct lookup
    from src.database import fetch_one
    row = await fetch_one(
        "SELECT * FROM harness_improvements WHERE id = $1", proposal_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return {"proposal": dict(row)}


@router.post("/improvements/{proposal_id}/approve")
async def approve_improvement(
    proposal_id: str,
    token: dict = Depends(get_verified_token),
):
    from src.database import fetch_one
    row = await fetch_one(
        "SELECT status FROM harness_improvements WHERE id = $1", proposal_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if row["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Proposal already {row['status']}")

    user_id = token.get("user_id", "")
    await update_proposal_status(proposal_id, "approved", reviewed_by=user_id)

    success = await apply_improvement(proposal_id)
    if success:
        return {"status": "applied", "proposal_id": proposal_id}
    return {"status": "approved_but_failed", "proposal_id": proposal_id}


@router.post("/improvements/{proposal_id}/reject")
async def reject_improvement(
    proposal_id: str,
    reason: str = "",
    token: dict = Depends(get_verified_token),
):
    from src.database import fetch_one
    row = await fetch_one(
        "SELECT status FROM harness_improvements WHERE id = $1", proposal_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Proposal not found")

    user_id = token.get("user_id", "")
    await update_proposal_status(proposal_id, "rejected", reviewed_by=user_id, reason=reason)
    return {"status": "rejected", "proposal_id": proposal_id}


@router.get("/prompts/active")
async def get_active_prompts(
    org_id: str,
    token: dict = Depends(get_verified_token),
):
    from src.database import fetch_all
    rows = await fetch_all(
        "SELECT node_name, prompt_text, version FROM prompt_versions WHERE org_id = $1 AND is_active = true",
        org_id,
    )
    return {"prompts": [dict(r) for r in rows]}


@router.get("/rubrics/active")
async def get_active_rubrics(
    org_id: str,
    token: dict = Depends(get_verified_token),
):
    from src.database import fetch_all
    rows = await fetch_all(
        "SELECT criterion_name, criterion_text, version FROM rubric_versions WHERE org_id = $1 AND is_active = true",
        org_id,
    )
    return {"rubrics": [dict(r) for r in rows]}


@router.get("/tools/config")
async def get_tool_configs(
    org_id: str,
    token: dict = Depends(get_verified_token),
):
    from src.database import fetch_all
    rows = await fetch_all(
        "SELECT name, description, implementation_type, config, version FROM tool_configs WHERE org_id = $1 AND enabled = true",
        org_id,
    )
    return {"tools": [dict(r) for r in rows]}
```

- [ ] **Step 2: Create test for API routes**

```python
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.api.app import app


@pytest.fixture
def client():
    return TestClient(app)


def test_get_active_prompts_requires_auth(client):
    response = client.get("/api/prompts/active?org_id=org1")
    assert response.status_code in (401, 403)


def test_get_active_rubrics_requires_auth(client):
    response = client.get("/api/rubrics/active?org_id=org1")
    assert response.status_code in (401, 403)


def test_get_tool_configs_requires_auth(client):
    response = client.get("/api/tools/config?org_id=org1")
    assert response.status_code in (401, 403)


def test_get_pending_improvements_requires_auth(client):
    response = client.get("/api/improvements/pending?org_id=org1")
    assert response.status_code in (401, 403)


def test_approve_improvement_not_found(client):
    response = client.post("/api/improvements/nonexistent/approve")
    assert response.status_code in (401, 403, 404)


def test_reject_improvement_not_found(client):
    response = client.post("/api/improvements/nonexistent/reject")
    assert response.status_code in (401, 403, 404)
```

- [ ] **Step 3: Wire router into app**

Add to `src/api/app.py` imports:

```python
from src.api.routes import (
    clerk,
    discord,
    docs,
    github,
    improvements,
    knowledge,
    memory,
    review,
    reviewers,
    reviews,
    slack,
)
```

Add before the SPA catch-all:

```python
app.include_router(improvements.router, prefix="/api", tags=["improvements"])
```

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/improvements.py src/api/app.py tests/
git commit -m "feat: add improvement review API endpoints"
```

---

### Task 10: Wire analytics into application lifespan

**Files:**
- Modify: `src/api/app.py`

- [ ] **Step 1: Initialize trace collector and hill climber in lifespan**

Modify the `lifespan` function in `src/api/app.py`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio

    from src.config import settings
    from src.integrations.discord_gateway import gateway
    from src.analytics.traces import TraceCollector
    from src.analytics.hill_climber import HillClimber
    from src.agents.graph import set_trace_collector

    await get_pool()

    # Initialize trace collection
    trace_collector = TraceCollector(
        flush_threshold=settings.trace_analysis_interval,
    )

    # Initialize hill climber
    hill_climber = HillClimber(
        trace_collector=trace_collector,
        org_id="",  # Will be set per-org dynamically
        analysis_interval=settings.trace_analysis_interval,
    )

    # Wire trace collector into the graph
    set_trace_collector(trace_collector)

    # Set callback to trigger analysis on flush
    async def on_flush():
        if await hill_climber.should_analyze():
            asyncio.create_task(hill_climber.run_analysis_cycle())

    trace_collector.set_on_flush_callback(on_flush)

    # Start Discord Gateway WebSocket in background if configured
    discord_task = None
    if settings.discord_bot_token.get_secret_value():
        discord_task = asyncio.create_task(gateway.start())

    yield

    # Flush remaining traces on shutdown
    await trace_collector.flush()

    # Stop Discord Gateway on shutdown
    await gateway.stop()
    if discord_task:
        discord_task.cancel()

    await close_pool()
```

- [ ] **Step 2: Commit**

```bash
git add src/api/app.py
git commit -m "feat: wire trace collection and hill climber into app lifespan"
```

---

### Task 11: Run all tests and fix any failures

- [ ] **Step 1: Run the full test suite**

```bash
uv run pytest tests/ -v
```

Expected: all tests pass (including existing ones)

- [ ] **Step 2: Run linting**

```bash
uv run ruff check src/
uv run mypy src/
```

Fix any lint/type issues.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address lint and type issues from loop engineering implementation"
```

---

## Phase 2 Additions (Improvement HITL)

Implemented in `docs/superpowers/plans/2026-07-30-improvement-hitl.md`:

- **Discord interactive blocks**: `build_discord_improvement_card()` in `discord_blocks.py` — embed with per-proposal Approve/Reject buttons routed through Discord's interaction webhook
- **Email notifications**: `send_improvement_notification()` in `email.py` — HTML template with per-proposal HMAC approve/reject links via SendGrid
- **GET HMAC endpoint**: `GET /improvements/token/{token}/action` in `improvements.py` — supports email link clicks (browsers send GET, not POST)
- **Discord interaction handler extended**: `discord.py` `handle_interactions()` now branches on `improvement_*` action prefixes
