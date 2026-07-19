# Fix RubricMiddleware Implementation

## Context

The current `ai_review_node_hybrid` in `src/agents/nodes/review.py` has incorrect `RubricMiddleware` usage based on the actual deepagents API documented at https://docs.langchain.com/oss/python/deepagents/rubric.

## Issues to Fix

### Issue 1: Wrong `_log_rubric_evaluation` callback signature
**File:** `src/agents/nodes/review.py:87-94`

Current (WRONG):
```python
def _log_rubric_evaluation(evaluation: dict) -> None:
    logger.info(
        "rubric_evaluation",
        score=evaluation.get("score"),      # ❌ Wrong field
        passed=evaluation.get("passed"),    # ❌ Wrong field
        feedback=evaluation.get("feedback", "")[:200],  # ❌ Wrong field
    )
```

Correct (per `RubricEvaluation` spec):
```python
def _log_rubric_evaluation(evaluation: dict) -> None:
    logger.info(
        "rubric_iteration",
        grading_run_id=evaluation.get("grading_run_id"),
        iteration=evaluation.get("iteration"),
        result=evaluation.get("result"),           # "satisfied" | "needs_revision" | etc.
        explanation=evaluation.get("explanation", "")[:200],
        criteria_count=len(evaluation.get("criteria", [])),
    )
```

### Issue 2: Not using existing `create_rubric_middleware()` wrapper
**File:** `src/agents/nodes/review.py:130-134`

Current (DUPLICATED):
```python
rubric_middleware = RubricMiddleware(
    model=settings.rubric_grader_model,
    max_iterations=settings.rubric_max_iterations,
    on_evaluation=_log_rubric_evaluation,
)
```

Should use the existing wrapper from `src/agents/middleware/rubric.py`:
```python
from src.agents.middleware.rubric import create_rubric_middleware

rubric_middleware = create_rubric_middleware()
```

### Issue 3: Confidence calculation uses wrong approach
**File:** `src/agents/nodes/review.py:176-183`

Current:
```python
if rubric_evaluations:
    last_eval = rubric_evaluations[-1]
    confidence = extract_confidence_from_rubric(last_eval)
    feedback = extract_feedback_from_rubric(last_eval)
```

The `extract_confidence_from_rubric` counts individual criteria pass/fail, but the rubric loop's terminal status is in `_rubric_status`. Should map status to confidence:
```python
STATUS_TO_CONFIDENCE = {
    "satisfied": 1.0,
    "needs_revision": 0.6,
    "max_iterations_reached": 0.4,
    "failed": 0.3,
    "grader_error": 0.5,
    "unknown": 0.5,
}

confidence = STATUS_TO_CONFIDENCE.get(rubric_status, 0.5)
```

### Issue 4: Missing `_check_research_needed` logic
**File:** `src/agents/nodes/review.py:97-106`

The function checks for "grounding" in criterion names, but this is fragile. Should check the `gap` field for grounding-related feedback instead:
```python
def _check_research_needed(evaluations: list) -> bool:
    for evaluation in evaluations:
        for criterion in evaluation.get("criteria", []):
            if not criterion.get("passed", True):
                gap = criterion.get("gap", "").lower()
                if "source" in gap or "citation" in gap or "grounding" in gap:
                    return True
    return False
```

### Issue 5: Remove unused `_log_rubric_evaluation` from review.py
After using `create_rubric_middleware()`, the local `_log_rubric_evaluation` in review.py is no longer needed. Remove it.

### Issue 6: Remove unused `_check_research_needed` from review.py
After simplifying the rubric status handling, `_check_research_needed` can be removed or simplified. The research-needed check should be based on `_rubric_status` or specific criteria gaps.

## Implementation Steps

1. **Update `src/agents/nodes/review.py`:**
   - Remove local `_log_rubric_evaluation` function
   - Remove local `_check_research_needed` function
   - Import `create_rubric_middleware` from `src.agents.middleware.rubric`
   - Replace `RubricMiddleware(...)` with `create_rubric_middleware()`
   - Update confidence calculation to use `_rubric_status` mapping
   - Simplify `rubric_status` return structure

2. **Update `src/agents/rubrics.py` (optional):**
   - Add `extract_confidence_from_status(status: str) -> float` helper
   - Keep existing `extract_confidence_from_rubric` for backward compatibility

3. **Update tests:**
   - Add test for `extract_confidence_from_status`
   - Update any tests that depend on the old callback signature

## Files to Modify

- `src/agents/nodes/review.py` (primary)
- `src/agents/rubrics.py` (add status-to-confidence helper)
- `tests/test_rubrics.py` (add tests for new helper)

## Verification

1. Run `ruff check src/agents/nodes/review.py src/agents/rubrics.py`
2. Run `python -m pytest tests/test_rubrics.py -v`
3. Run full test suite `python -m pytest tests/ -v`
