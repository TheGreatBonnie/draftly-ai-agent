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
            '- "criteria": list of {{"name": str, "passed": bool, "gap": str}}\n'
            '  for each criterion\n\n'
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
