# Implementation Plan: Deep Agents + LangGraph Hybrid

**Date:** 2025-07-19
**Feature:** Integrate Deep agents capabilities into existing LangGraph workflow
**Status:** Ready for implementation
**Note:** Most components are already implemented. This plan focuses on fixing integration issues.

---

## Overview

Enhance Draftly's LangGraph pipeline with Deep agents capabilities:

1. **Rubric Grading** - Replace simple confidence scoring with LLM-as-a-judge
2. **Parallel Research** - Use subagents for concurrent research tasks
3. **Skills-Guided Retrieval** - Adaptive research strategies
4. **Todo-Driven Investigation** - Break complex questions into tasks

---

## Architecture

### Current State

```
┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐
│ Ingest  │───▶│ Memory       │───▶│ Research │───▶│ Synthesize│
└─────────┘    └──────────────┘    └──────────┘    └───────────┘
                                                       │
                                                       ▼
  ┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐
  │ Publish │◀───│ Human Review │◀───│ AI       │◀───│ Write     │
  │         │    │ (HITL)       │    │ Review   │    │ Docs      │
  └─────────┘    └──────────────┘    └──────────┘    └───────────┘
```

### Hybrid State (Target)

```
┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐
│ Ingest  │───▶│ Memory       │───▶│ Research │───▶│ Synthesize│
│(hybrid) │    └──────────────┘    │(subagent)│    └───────────┘
└─────────┘                        └──────────┘          │
                                                         ▼
  ┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐
  │ Publish │◀───│ Human Review │◀───│ Rubric   │◀───│ Write     │
  │         │    │ (HITL)       │    │ Grading  │    │ Docs      │
  └─────────┘    └──────────────┘    └──────────┘    └───────────┘
```

---

## Existing Implementation Status

### ✅ Already Implemented

| Component | File | Status |
|-----------|------|--------|
| Documentation rubric | `src/agents/rubrics.py` | Complete |
| Research/Synthesis/Review rubrics | `src/agents/rubrics.py` | Complete |
| Rubric helper functions | `src/agents/rubrics.py` | Complete |
| Research subagent definition | `src/agents/subagents/__init__.py` | Complete |
| Synthesis subagent definition | `src/agents/subagents/__init__.py` | Complete |
| Review subagent definition | `src/agents/subagents/__init__.py` | Complete |
| Research skills (5 types) | `src/agents/skills/__init__.py` | Complete |
| Investigation planner | `src/agents/planners/investigation.py` | Complete |
| Rubric middleware wrapper | `src/agents/middleware/rubric.py` | Complete |
| State schema (hybrid fields) | `src/agents/state.py` | Complete |
| Hybrid graph builder | `src/agents/graph.py` | Complete |
| Rubric routing logic | `src/agents/graph.py` | Complete |
| Hybrid ingest node | `src/agents/nodes/ingest.py` | Complete |
| Hybrid research node | `src/agents/nodes/research.py` | Complete |
| Hybrid review node | `src/agents/nodes/review.py` | Complete |

### ❌ Issues to Fix

| Issue | File | Problem |
|-------|------|---------|
| Graph uses standard nodes | `src/agents/graph.py` | `build_hybrid_graph()` uses `ingest_node` instead of `ingest_node_hybrid` |
| Import error in agents init | `src/agents/__init__.py` | Imports `RubricMiddleware` which doesn't exist in module |
| Missing skills functions | `src/agents/skills/__init__.py` | `get_skill_for_question` and `select_documentation_type` not defined |
| Missing planner export | `src/agents/planners/__init__.py` | `_classify_complexity` not exported |

---

## Phase 1: Fix Import Errors

### 1.1 Fix agents __init__.py

**File:** `src/agents/__init__.py`

The file imports `RubricMiddleware` from `src.agents.middleware.rubric`, but that module only exports `create_rubric_middleware`.

**Fix:** Remove the invalid import or update it to the correct function.

---

## Phase 2: Fix Graph Integration

### 2.1 Update hybrid graph to use hybrid nodes

**File:** `src/agents/graph.py`

Current `build_hybrid_graph()` uses standard nodes. It should use the hybrid variants:

```python
def build_hybrid_graph():
    """Build enhanced graph with Deep agents capabilities."""
    from src.agents.middleware.rubric import create_rubric_middleware
    from src.agents.nodes.ingest import ingest_node_hybrid
    from src.agents.nodes.research import research_node_hybrid
    from src.agents.nodes.review import ai_review_node_hybrid

    graph = StateGraph(DocumentationState)

    # Add hybrid nodes
    graph.add_node("ingest", ingest_node_hybrid)
    graph.add_node("memory_retrieve", memory_retrieve_node)
    graph.add_node("research", research_node_hybrid)
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("write_docs", write_docs_node)
    graph.add_node("ai_review", ai_review_node_hybrid)
    graph.add_node("human_review", human_review_node)
    graph.add_node("publish", publish_node)

    # ... rest of edges
```

---

## Phase 3: Fix Missing Functions

### 3.1 Add get_skill_for_question function

**File:** `src/agents/skills/__init__.py`

The `ingest_node_hybrid` calls `get_skill_for_question(question, "research")` but only `get_skill_for_question_type` exists.

**Fix:** Add the missing function:

```python
def get_skill_for_question(question: str, skill_type: str = "research") -> dict:
    """Get research skill based on question content."""
    # Simple heuristic classification
    question_lower = question.lower()
    
    if any(w in question_lower for w in ["error", "exception", "fail", "bug"]):
        skill_name = "troubleshooting"
    elif any(w in question_lower for w in ["config", "setting", "env"]):
        skill_name = "configuration"
    elif any(w in question_lower for w in ["tutorial", "how to", "guide"]):
        skill_name = "tutorial"
    elif any(w in question_lower for w in ["what is", "explain", "concept"]):
        skill_name = "conceptual"
    else:
        skill_name = "api_question"
    
    return {
        "name": skill_name,
        "strategy": RESEARCH_SKILLS.get(skill_name, RESEARCH_SKILLS["api_question"]),
    }
```

### 3.2 Add select_documentation_type function

**File:** `src/agents/skills/__init__.py`

```python
def select_documentation_type(question: str) -> str:
    """Select documentation type based on question."""
    question_lower = question.lower()
    
    if any(w in question_lower for w in ["error", "exception", "fail", "bug", "issue"]):
        return "troubleshooting"
    elif any(w in question_lower for w in ["tutorial", "how to", "guide", "step"]):
        return "tutorial"
    elif any(w in question_lower for w in ["what is", "explain", "concept", "difference"]):
        return "faq"
    elif any(w in question_lower for w in ["api", "reference", "parameter", "method"]):
        return "reference"
    else:
        return "howto"
```

### 3.3 Export _classify_complexity

**File:** `src/agents/planners/__init__.py`

```python
from src.agents.planners.investigation import (
    create_investigation_plan,
    format_plan_for_display,
    _classify_complexity,
)

__all__ = ["create_investigation_plan", "format_plan_for_display", "_classify_complexity"]
```

---

## Phase 4: Fix Rubric Middleware Usage

### 4.1 Update review node to use deepagents correctly

**File:** `src/agents/nodes/review.py`

The current `ai_review_node_hybrid` has incorrect RubricMiddleware usage. Based on the actual API:

```python
async def ai_review_node_hybrid(state: DocumentationState) -> dict:
    """Enhanced review node with rubric grading for hybrid pipeline."""
    from deepagents import create_deep_agent, RubricMiddleware
    from src.agents.rubrics import DOCUMENTATION_RUBRIC, extract_confidence_from_rubric, extract_feedback_from_rubric
    from src.config import settings

    logger.info("ai_review_hybrid_started", org_id=state["org_id"])

    # Standard review prompt
    prompt = REVIEW_PROMPT.format(
        question=state["question"],
        content=state.get("draft_content", ""),
        knowledge_package=json.dumps(state.get("knowledge_package", {}), indent=2),
    )

    # Create agent with rubric middleware
    rubric_middleware = RubricMiddleware(
        model=settings.rubric_grader_model,
        max_iterations=settings.rubric_max_iterations,
        on_evaluation=_log_rubric_evaluation,
    )

    agent = create_deep_agent(
        model=settings.deepagents_model,
        system_prompt="You are a documentation reviewer. Evaluate quality and provide feedback.",
        middleware=[rubric_middleware],
    )

    # Invoke with rubric
    result = await agent.ainvoke({
        "messages": [{"role": "user", "content": prompt}],
        "rubric": DOCUMENTATION_RUBRIC,
    })

    # Extract results from rubric state
    messages = result.get("messages", [])
    last_message = messages[-1].content if messages else ""

    # Parse review from response
    try:
        review = json.loads(last_message)
    except json.JSONDecodeError:
        import re
        json_match = re.search(r"\{[\s\S]*\}", last_message)
        if json_match:
            review = json.loads(json_match.group())
        else:
            review = {
                "confidence": 0.5,
                "issues": ["Review parsing failed"],
                "suggestions": [],
                "passed": False,
            }

    # Get rubric status from private state
    rubric_status = result.get("_rubric_status", "unknown")
    rubric_evaluations = result.get("_rubric_evaluations", [])

    # Calculate confidence from rubric
    if rubric_evaluations:
        last_eval = rubric_evaluations[-1]
        confidence = extract_confidence_from_rubric(last_eval)
        feedback = extract_feedback_from_rubric(last_eval)
    else:
        confidence = review.get("confidence", 0.5)
        feedback = review.get("issues", [])

    # Update documentation
    doc_id = state.get("doc_id")
    if doc_id:
        await execute(
            "UPDATE documentation SET confidence_score = $1 WHERE id = $2",
            confidence,
            doc_id,
        )

    logger.info(
        "ai_review_hybrid_completed",
        confidence=confidence,
        rubric_status=rubric_status,
    )

    return {
        "confidence_score": confidence,
        "review_result": review,
        "review_feedback": json.dumps(feedback) if isinstance(feedback, list) else feedback,
        "rubric_status": {
            "satisfied": rubric_status == "satisfied",
            "needs_revision": rubric_status == "needs_revision",
            "research_needed": _check_research_needed(rubric_evaluations),
            "feedback": feedback,
        },
    }


def _log_rubric_evaluation(ev: dict) -> None:
    """Log rubric evaluation results."""
    logger.info(
        "rubric_evaluation",
        grading_run_id=ev.get("grading_run_id"),
        iteration=ev.get("iteration"),
        result=ev.get("result"),
        explanation=ev.get("explanation", "")[:200],
        criteria_count=len(ev.get("criteria", [])),
    )


def _check_research_needed(evaluations: list) -> bool:
    """Check if research is needed based on rubric feedback."""
    if not evaluations:
        return False
    
    last_eval = evaluations[-1]
    criteria = last_eval.get("criteria", [])
    
    # Check if grounding criteria failed
    for c in criteria:
        name = c.get("name", "").lower()
        if "grounding" in name or "citation" in name:
            if not c.get("passed", True):
                return True
    
    return False
```

---

## Phase 5: Add Deep Agents Dependency

### 5.1 Update pyproject.toml

**File:** `pyproject.toml`

```toml
dependencies = [
    # ... existing ...
    "deepagents>=0.6.5",
]
```

---

## Implementation Order

| Step | Task | Estimated Time |
|------|------|----------------|
| 1 | Fix agents __init__.py import | 5 min |
| 2 | Add missing skills functions | 15 min |
| 3 | Export _classify_complexity | 5 min |
| 4 | Update hybrid graph to use hybrid nodes | 15 min |
| 5 | Fix review node rubric usage | 30 min |
| 6 | Add deepagents dependency | 5 min |
| 7 | Run tests | 15 min |

**Total estimated time:** ~1.5 hours

---

## Success Criteria

1. `build_hybrid_graph()` uses hybrid node variants
2. No import errors in agents module
3. RubricMiddleware integrates with deepagents library
4. All existing tests pass
5. Hybrid graph can be invoked without errors

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| deepagents API changes | Pin version >=0.6.5, <0.7.0 |
| RubricMiddleware beta status | Wrap in try/except, fallback to standard review |
| Performance overhead | Profile rubric grading, adjust max_iterations |
