from __future__ import annotations

import json

import structlog

from src.agents.state import DocumentationState
from src.database import execute
from src.integrations.llm import call_bedrock

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
    """Enhanced review node with rubric grading for hybrid pipeline."""
    from deepagents import create_deep_agent

    from src.agents.middleware.rubric import create_rubric_middleware
    from src.agents.rubrics import (
        DOCUMENTATION_RUBRIC,
        extract_confidence_from_status,
        extract_feedback_from_rubric,
    )
    from src.config import settings

    logger.info("ai_review_hybrid_started", org_id=state["org_id"])

    # Standard review prompt
    prompt = REVIEW_PROMPT.format(
        question=state["question"],
        content=state.get("draft_content", ""),
        knowledge_package=json.dumps(state.get("knowledge_package", {}), indent=2),
    )

    # Create agent with rubric middleware
    rubric_middleware = create_rubric_middleware()
    if rubric_middleware is None:
        raise RuntimeError("deepagents is required for hybrid review node")

    agent = create_deep_agent(
        model=settings.deepagents_model,
        system_prompt=(
            "You are a documentation reviewer. Evaluate the quality of documentation "
            "against the provided rubric criteria. Be thorough, accurate, and constructive."
        ),
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

    # Calculate confidence from rubric terminal status
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
