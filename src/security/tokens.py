from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta

import structlog

from src.config import settings

logger = structlog.get_logger()


def generate_review_token(
    reviewer_id: str,
    review_id: str,
    expiry_hours: int = 24,
) -> str:
    """Generate time-limited token for quick actions."""
    payload = {
        "reviewer_id": reviewer_id,
        "review_id": review_id,
        "expires_at": (datetime.utcnow() + timedelta(hours=expiry_hours)).isoformat(),
    }
    data = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    signature = hmac.new(
        settings.secret_key.encode(), data.encode(), hashlib.sha256
    ).hexdigest()
    return f"{data}.{signature}"


def verify_review_token(token: str) -> dict | None:
    """Verify and decode review token. Returns None if invalid/expired."""
    try:
        data, signature = token.split(".")
        expected = hmac.new(
            settings.secret_key.encode(), data.encode(), hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected):
            logger.warning("token_signature_invalid")
            return None

        payload = json.loads(base64.urlsafe_b64decode(data))

        if datetime.fromisoformat(payload["expires_at"]) < datetime.utcnow():
            logger.warning("token_expired", expires_at=payload["expires_at"])
            return None

        return payload
    except Exception as e:
        logger.error("token_verification_failed", error=str(e))
        return None
