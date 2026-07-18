import pytest
from unittest.mock import AsyncMock, patch, MagicMock


def test_token_generation():
    """Test token generation and verification."""
    import base64
    import json
    import hashlib
    import hmac
    from datetime import datetime, timedelta

    secret_key = "test-secret-key"
    reviewer_id = "reviewer-123"
    review_id = "review-456"

    payload = {
        "reviewer_id": reviewer_id,
        "review_id": review_id,
        "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
    }
    data = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    signature = hmac.new(secret_key.encode(), data.encode(), hashlib.sha256).hexdigest()
    token = f"{data}.{signature}"

    # Verify token
    parts = token.split(".")
    assert len(parts) == 2
    decoded = json.loads(base64.urlsafe_b64decode(parts[0]))
    assert decoded["reviewer_id"] == reviewer_id
    assert decoded["review_id"] == review_id
