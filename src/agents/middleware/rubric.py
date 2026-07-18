from __future__ import annotations

import structlog

from src.config import settings

logger = structlog.get_logger()


def create_rubric_middleware(rubric: str | None = None):
    """Create RubricMiddleware for documentation quality grading."""
    try:
        from deepagents import RubricMiddleware
    except ImportError:
        logger.warning("deepagents_not_installed")
        return None

    return RubricMiddleware(
        model=settings.rubric_grader_model,
        system_prompt=(
            "You are a documentation quality reviewer. "
            "Evaluate the output against the provided rubric criteria. "
            "Be strict but fair. Provide specific feedback for failing criteria."
        ),
        max_iterations=settings.rubric_max_iterations,
        on_evaluation=_log_evaluation,
    )


def _log_evaluation(ev: dict) -> None:
    """Log rubric evaluation results."""
    logger.info(
        "rubric_evaluation",
        grading_run_id=ev.get("grading_run_id"),
        iteration=ev.get("iteration"),
        result=ev.get("result"),
        explanation=ev.get("explanation", "")[:200],
        criteria_count=len(ev.get("criteria", [])),
    )
