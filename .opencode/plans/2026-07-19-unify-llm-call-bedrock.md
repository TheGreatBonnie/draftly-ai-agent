# Unify LLM Usage: Replace deepagents with call_bedrock Pattern

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `deepagents` dependency in research and review nodes with the existing `call_bedrock` pattern (ChatOpenAI via Requesty), routing all models through Requesty.

**Architecture:** All LLM calls go through a single `call_llm()` function in `src/integrations/llm.py` that routes to the correct ChatOpenAI instance based on model name. Research node calls `search_web` directly in Python instead of delegating to a deepagents subagent. Review node implements rubric grading as a manual loop using `call_llm()`.

**Tech Stack:** langchain-openai (ChatOpenAI), langchain-core (messages, tools), structlog, pydantic-settings

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/integrations/llm.py` | **Modify** | Add `call_llm()` with model routing, keep `call_bedrock` as alias |
| `src/config.py` | **Modify** | Add `research_model`, `review_model`, `rubric_grader_model` (Requesty model names); remove deepagents settings |
| `.env.example` | **Modify** | Replace deepagents env vars with new model configs |
| `src/agents/nodes/research.py` | **Rewrite** | Replace `create_deep_agent` with direct `search_web` + `call_llm` |
| `src/agents/nodes/review.py` | **Rewrite** | Replace `create_deep_agent` + `RubricMiddleware` with manual rubric loop |
| `src/agents/subagents/__init__.py` | **Delete** | No longer needed |
| `src/agents/middleware/rubric.py` | **Rewrite** | Replace deepagents middleware with `grade_with_rubric()` function |
| `src/agents/__init__.py` | **Modify** | Remove deepagents imports |
| `pyproject.toml` | **Modify** | Remove `deepagents` dependency |

---

## Task 1: Refactor LLM integration to support model routing

**Files:**
- Modify: `src/integrations/llm.py`

- [ ] **Step 1: Rewrite `src/integrations/llm.py`**

```python
from __future__ import annotations

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from src.config import settings

logger = structlog.get_logger()

_llm_cache: dict[str, ChatOpenAI] = {}


def get_llm(model: str | None = None) -> ChatOpenAI:
    """Get a ChatOpenAI instance for the given model (or default model)."""
    model = model or settings.llm_model
    if model not in _llm_cache:
        _llm_cache[model] = ChatOpenAI(
            openai_api_key=settings.requesty_api_key,
            openai_api_base=settings.requesty_base_url,
            model_name=model,
            temperature=0.3,
        )
    return _llm_cache[model]


async def call_llm(
    prompt: str,
    system_prompt: str = "",
    model: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    """Call an LLM via Requesty with the given model."""
    llm = get_llm(model)
    llm.temperature = temperature

    messages = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))
    messages.append(HumanMessage(content=prompt))

    logger.info("llm_call", model=model or settings.llm_model, prompt_length=len(prompt))

    response = await llm.ainvoke(messages)

    text = response.content if isinstance(response.content, str) else str(response.content)
    logger.info("llm_response", response_length=len(text))
    return text


async def call_bedrock(
    prompt: str,
    system_prompt: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    """Backward-compatible wrapper — calls default model."""
    return await call_llm(prompt, system_prompt=system_prompt, max_tokens=max_tokens, temperature=temperature)
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `cd /Applications/Projects/OpenCode/draftly && python -m pytest tests/ -v --tb=short 2>&1 | head -50`
Expected: Existing tests pass (or no tests exist yet — that's fine)

- [ ] **Step 3: Commit**

```bash
git add src/integrations/llm.py
git commit -m "refactor: add call_llm with model routing, keep call_bedrock as alias"
```

---

## Task 2: Update config to support per-stage model routing

**Files:**
- Modify: `src/config.py`
- Modify: `.env.example`

- [ ] **Step 1: Update `src/config.py`**

Replace the deepagents settings block with per-stage model configs:

```python
# In the Settings class, replace:
#   deepagents_model: str = "anthropic:claude-sonnet-4-6"
#   rubric_grader_model: str = "anthropic:claude-haiku-4-5"
#   rubric_max_iterations: int = 3
#   research_max_concurrent: int = 3
#
# With:
    # Per-stage LLM models (all routed through Requesty)
    research_model: str = "anthropic/claude-sonnet-4-6"
    review_model: str = "anthropic/claude-sonnet-4-6"
    rubric_grader_model: str = "anthropic/claude-haiku-4-5"
    rubric_max_iterations: int = 3
```

- [ ] **Step 2: Update `.env.example`**

Replace the deepagents block:

```bash
# Per-stage LLM models (all routed through Requesty)
RESEARCH_MODEL=anthropic/claude-sonnet-4-6
REVIEW_MODEL=anthropic/claude-sonnet-4-6
RUBRIC_GRADER_MODEL=anthropic/claude-haiku-4-5
RUBRIC_MAX_ITERATIONS=3
```

- [ ] **Step 3: Commit**

```bash
git add src/config.py .env.example
git commit -m "config: replace deepagents settings with per-stage model routing"
```

---

## Task 3: Rewrite research node to use call_llm + direct tool calls

**Files:**
- Rewrite: `src/agents/nodes/research.py`

- [ ] **Step 1: Rewrite `src/agents/nodes/research.py`**

```python
from __future__ import annotations

import structlog

from src.agents.state import DocumentationState

logger = structlog.get_logger()


async def research_node_hybrid(state: DocumentationState) -> dict:
    """Research node: runs search_web directly, then synthesizes via call_llm."""
    from src.agents.planners.investigation import create_investigation_plan
    from src.agents.skills import get_skill_for_question
    from src.agents.tools.web_tools import search_web
    from src.config import settings
    from src.integrations.llm import call_llm

    question = state["question"]
    org_id = state["org_id"]

    logger.info("research_hybrid_started", org_id=org_id)

    # Get research skill
    research_skill = get_skill_for_question(question, "research")

    # Create investigation plan
    investigation_plan = create_investigation_plan(question)

    # Execute web searches directly for each plan task
    web_results = []
    for task in investigation_plan[:5]:
        query = task.get("description", task.get("task", question))
        try:
            result = await search_web.ainvoke({"query": query, "max_results": 3})
            web_results.append(result)
        except Exception as e:
            logger.warning("search_failed", query=query, error=str(e))

    # Synthesize findings via LLM
    research_context = "\n\n---\n\n".join(web_results) if web_results else "No web results found."

    skill_strategy = research_skill.get("strategy", {})
    research_focus = skill_strategy.get("focus", "general research")

    synthesis_prompt = (
        f"Research the following question and return a comprehensive summary.\n\n"
        f"Question: {question}\n\n"
        f"Research focus: {research_focus}\n\n"
        f"Web search results:\n{research_context}"
    )

    summary = await call_llm(
        prompt=synthesis_prompt,
        system_prompt=(
            "You are a research coordinator. Synthesize the provided web search results "
            "into a comprehensive research summary with key findings, source URLs, "
            "and confidence assessment."
        ),
        model=settings.research_model,
    )

    logger.info(
        "research_hybrid_completed",
        web_results=len(web_results),
        skill=research_skill.get("name", "none"),
        plan_tasks=len(investigation_plan),
    )

    return {
        "github_context": [],
        "slack_context": [],
        "research_skill": research_skill,
        "investigation_plan": investigation_plan,
        "subagent_results": {
            "summary": summary,
            "web_results": web_results,
        },
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/agents/nodes/research.py
git commit -m "refactor: replace deepagents in research node with direct search_web + call_llm"
```

---

## Task 4: Rewrite rubric middleware as a standalone function

**Files:**
- Rewrite: `src/agents/middleware/rubric.py`

- [ ] **Step 1: Rewrite `src/agents/middleware/rubric.py`**

```python
from __future__ import annotations

import json
import re

import structlog

from src.config import settings
from src.integrations.llm import call_llm

logger = structlog.get_logger()


async def grade_with_rubric(
    content: str,
    rubric: str,
    system_prompt: str = "",
    max_iterations: int | None = None,
) -> dict:
    """Grade content against a rubric using an LLM. Returns rubric status and evaluations.

    Returns:
        {
            "status": "satisfied" | "needs_revision" | "max_iterations_reached",
            "evaluations": list of evaluation dicts,
            "final_content": str (the last reviewed content),
        }
    """
    max_iterations = max_iterations or settings.rubric_max_iterations
    evaluations = []
    current_content = content

    for iteration in range(1, max_iterations + 1):
        grading_prompt = (
            f"## Content to Evaluate\n\n{current_content}\n\n"
            f"## Rubric\n\n{rubric}\n\n"
            "Evaluate the content against each rubric criterion. "
            "Return a JSON object with:\n"
            '- "result": "satisfied" or "needs_revision"\n'
            '- "explanation": brief overall explanation\n'
            '- "criteria": list of {{"name": str, "passed": bool, "gap": str}} for each criterion\n\n'
            "Return ONLY valid JSON."
        )

        grader_response = await call_llm(
            prompt=grading_prompt,
            system_prompt=system_prompt or (
                "You are a documentation quality reviewer. "
                "Evaluate the output against the provided rubric criteria. "
                "Be strict but fair. Provide specific feedback for failing criteria."
            ),
            model=settings.rubric_grader_model,
        )

        # Parse evaluation
        evaluation = _parse_grading_response(grader_response, iteration)
        evaluations.append(evaluation)

        logger.info(
            "rubric_evaluation",
            iteration=iteration,
            result=evaluation.get("result", "unknown"),
            explanation=evaluation.get("explanation", "")[:200],
            criteria_count=len(evaluation.get("criteria", [])),
        )

        if evaluation.get("result") == "satisfied":
            return {
                "status": "satisfied",
                "evaluations": evaluations,
                "final_content": current_content,
            }

    return {
        "status": "max_iterations_reached",
        "evaluations": evaluations,
        "final_content": current_content,
    }


def _parse_grading_response(response: str, iteration: int) -> dict:
    """Parse the grader LLM response into a structured evaluation."""
    try:
        evaluation = json.loads(response)
    except json.JSONDecodeError:
        json_match = re.search(r"\{[\s\S]*\}", response)
        if json_match:
            try:
                evaluation = json.loads(json_match.group())
            except json.JSONDecodeError:
                evaluation = {
                    "result": "needs_revision",
                    "explanation": "Failed to parse grader response",
                    "criteria": [],
                }
        else:
            evaluation = {
                "result": "needs_revision",
                "explanation": "No JSON found in grader response",
                "criteria": [],
            }

    evaluation["iteration"] = iteration
    evaluation["grading_run_id"] = f"rubric-{iteration}"
    return evaluation
```

- [ ] **Step 2: Commit**

```bash
git add src/agents/middleware/rubric.py
git commit -m "refactor: replace deepagents RubricMiddleware with standalone grade_with_rubric"
```

---

## Task 5: Rewrite review node to use call_llm + grade_with_rubric

**Files:**
- Rewrite: `src/agents/nodes/review.py`

- [ ] **Step 1: Rewrite `src/agents/nodes/review.py`**

```python
from __future__ import annotations

import json

import structlog

from src.agents.state import DocumentationState
from src.config import settings
from src.database import execute
from src.integrations.llm import call_llm

logger = structlog.get_logger()


def _check_research_needed(evaluations: list) -> bool:
    """Check if any rubric evaluation indicates research is needed."""
    for evaluation in evaluations:
        for criterion in evaluation.get("criteria", []):
            if not criterion.get("passed", True):
                gap = criterion.get("gap", "").lower()
                if "source" in gap or "citation" in gap or "grounding" in gap:
                    return True
    return False


REVIEW_PROMPT = """You are a documentation reviewer. Evaluate the quality of this documentation.

## Original Question
{question}

## Documentation to Review
{content}

## Knowledge Package (ground truth)
{knowledge_package}

Review for:
1. Factual accuracy — does it match the knowledge package?
2. Completeness — does it answer the original question?
3. Code accuracy — are code examples syntactically correct?
4. Clarity — is it easy to follow?
5. Missing steps — are there gaps in the instructions?

Return a JSON object with:
- "confidence": float between 0.0 and 1.0
- "issues": list of specific issues found
- "suggestions": list of improvement suggestions
- "passed": boolean

Return ONLY valid JSON, no other text."""


async def ai_review_node_hybrid(state: DocumentationState) -> dict:
    """Review node: generates review via call_llm, then grades with rubric."""
    from src.agents.middleware.rubric import grade_with_rubric
    from src.agents.rubrics import (
        DOCUMENTATION_RUBRIC,
        extract_confidence_from_status,
        extract_feedback_from_rubric,
    )

    logger.info("ai_review_hybrid_started", org_id=state["org_id"])

    # Generate review via LLM
    prompt = REVIEW_PROMPT.format(
        question=state["question"],
        content=state.get("draft_content", ""),
        knowledge_package=json.dumps(state.get("knowledge_package", {}), indent=2),
    )

    review_response = await call_llm(
        prompt=prompt,
        system_prompt=(
            "You are a documentation reviewer. Evaluate the quality of documentation "
            "against the provided rubric criteria. Be thorough, accurate, and constructive."
        ),
        model=settings.review_model,
    )

    # Parse review from response
    try:
        review = json.loads(review_response)
    except json.JSONDecodeError:
        import re
        json_match = re.search(r"\{[\s\S]*\}", review_response)
        if json_match:
            review = json.loads(json_match.group())
        else:
            review = {
                "confidence": 0.5,
                "issues": ["Review parsing failed"],
                "suggestions": [],
                "passed": False,
            }

    # Grade with rubric
    rubric_result = await grade_with_rubric(
        content=review_response,
        rubric=DOCUMENTATION_RUBRIC,
    )

    rubric_status = rubric_result["status"]
    rubric_evaluations = rubric_result["evaluations"]

    # Calculate confidence from rubric status
    confidence = extract_confidence_from_status(rubric_status)

    # Extract feedback from last evaluation
    feedback = review.get("issues", [])
    if rubric_evaluations:
        last_eval = rubric_evaluations[-1]
        feedback = extract_feedback_from_rubric(last_eval)

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
```

- [ ] **Step 2: Commit**

```bash
git add src/agents/nodes/review.py
git commit -m "refactor: replace deepagents in review node with call_llm + grade_with_rubric"
```

---

## Task 6: Delete subagents module and update imports

**Files:**
- Delete: `src/agents/subagents/__init__.py`
- Modify: `src/agents/__init__.py`

- [ ] **Step 1: Delete `src/agents/subagents/__init__.py`**

```bash
rm src/agents/subagents/__init__.py
```

- [ ] **Step 2: Update `src/agents/__init__.py`**

Remove all deepagents-related imports. The file should only export:

```python
"""LangGraph agent system for Draftly."""

from src.agents.graph import build_hybrid_graph
from src.agents.middleware.rubric import grade_with_rubric
from src.agents.planners.investigation import create_investigation_plan
from src.agents.rubrics import DOCUMENTATION_RUBRIC, RESEARCH_RUBRIC, SYNTHESIS_RUBRIC
from src.agents.skills import (
    RESEARCH_SKILLS,
    get_skill_for_question,
    select_documentation_type,
)
from src.agents.state import DocumentationState

__all__ = [
    "build_hybrid_graph",
    "DocumentationState",
    "DOCUMENTATION_RUBRIC",
    "RESEARCH_RUBRIC",
    "SYNTHESIS_RUBRIC",
    "grade_with_rubric",
    "RESEARCH_SKILLS",
    "get_skill_for_question",
    "select_documentation_type",
    "create_investigation_plan",
]
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove deepagents subagents module, update agent exports"
```

---

## Task 7: Remove deepagents dependency

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Remove `deepagents` from `pyproject.toml`**

Remove both lines:
```
    "deepagents>=0.6.5",
```
and
```
    "deepagents>=0.6.12",
```

- [ ] **Step 2: Update lock file**

Run: `cd /Applications/Projects/OpenCode/draftly && pip install -e . 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add pyproject.toml
git commit -m "chore: remove deepagents dependency"
```

---

## Task 8: Verify no remaining deepagents references

**Files:**
- None (verification only)

- [ ] **Step 1: Search for remaining deepagents imports**

Run: `cd /Applications/Projects/OpenCode/draftly && grep -r "deepagents" src/ --include="*.py"`
Expected: No results

- [ ] **Step 2: Run linting**

Run: `cd /Applications/Projects/OpenCode/draftly && python -m ruff check src/`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 3: Run type checking**

Run: `cd /Applications/Projects/OpenCode/draftly && python -m mypy src/ --ignore-missing-imports 2>&1 | tail -20`
Expected: No new errors

- [ ] **Step 4: Run tests**

Run: `cd /Applications/Projects/OpenCode/draftly && python -m pytest tests/ -v --tb=short 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve lint/type issues from deepagents removal"
```
