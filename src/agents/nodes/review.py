from __future__ import annotations

import json
import structlog

from src.agents.state import DocumentationState
from src.integrations.bedrock import call_bedrock
from src.database import execute

logger = structlog.get_logger()

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


async def ai_review_node(state: DocumentationState) -> dict:
    logger.info("ai_review_started", org_id=state["org_id"])

    prompt = REVIEW_PROMPT.format(
        question=state["question"],
        content=state.get("draft_content", ""),
        knowledge_package=json.dumps(state.get("knowledge_package", {}), indent=2),
    )

    response = await call_bedrock(prompt)

    try:
        review = json.loads(response)
    except json.JSONDecodeError:
        import re
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            review = json.loads(json_match.group())
        else:
            review = {"confidence": 0.5, "issues": ["Review parsing failed"], "suggestions": [], "passed": False}

    confidence = review.get("confidence", 0.5)

    # Update documentation with confidence score
    doc_id = state.get("doc_id")
    if doc_id:
        await execute(
            "UPDATE documentation SET confidence_score = $1 WHERE id = $2",
            confidence, doc_id,
        )

    logger.info("ai_review_completed", confidence=confidence, passed=review.get("passed", False))

    return {
        "confidence_score": confidence,
        "review_result": review,
        "review_feedback": json.dumps(review.get("issues", [])),
    }
