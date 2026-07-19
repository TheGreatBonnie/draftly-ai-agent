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
