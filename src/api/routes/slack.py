from __future__ import annotations

import json

import structlog
from fastapi import APIRouter, Form, Request
from fastapi.responses import JSONResponse

from src.memory.reviewer import complete_review
from src.security.tokens import verify_review_token

logger = structlog.get_logger()

router = APIRouter()

STATUS_MAP = {
    "approve": "approved",
    "reject": "rejected",
    "revise": "needs_changes",
}


@router.post("/interactivity")
async def handle_slack_interactivity(
    request: Request,
    payload: str = Form(...),
) -> JSONResponse:
    """Handle Slack interactivity payloads (button clicks, dropdowns)."""
    form_data = await request.form()
    payload_str = str(form_data.get("payload", "{}"))
    payload_data = json.loads(payload_str)

    if payload_data.get("type") == "block_actions":
        actions = payload_data.get("actions", [])

        for action in actions:
            action_id = action.get("action_id")
            token = action.get("value")

            if action_id in ("approve_review", "reject_review", "revise_review"):
                decision = action_id.replace("_review", "")
                token_data = verify_review_token(token)
                if token_data:
                    review_id: str = token_data.get("review_id", "")
                    await complete_review(
                        review_id=review_id,
                        status=STATUS_MAP[decision],
                        feedback=None,
                    )

                    try:
                        from src.agents.runners.resume import resume_review

                        await resume_review(
                            review_id=review_id,
                            decision=decision,
                            feedback="",
                        )
                    except Exception as e:
                        logger.error(
                            "graph_resume_failed",
                            review_id=review_id,
                            error=str(e),
                        )

                    return JSONResponse(
                        content={
                            "text": f"Review {decision}d successfully",
                            "replace_original": False,
                        }
                    )

    return JSONResponse(content={})
