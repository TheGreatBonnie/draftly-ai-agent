"""Tests for GET /api/activity/events telemetry endpoint."""
from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_get_agent_events_returns_rows():
    from src.api.routes.activity import get_agent_events

    mock_token = {"org_id": "org-1"}
    rows = [
        {
            "event_type": "ingest_hybrid_started",
            "level": "info",
            "details": {"question": "How?"},
            "created_at": datetime(2026, 7, 31, 4, 22, 45),
        }
    ]
    with patch(
        "src.api.routes.activity.fetch_all", new_callable=AsyncMock, return_value=rows
    ):
        result = await get_agent_events(limit=50, token=mock_token)

    assert len(result) == 1
    assert result[0]["event_type"] == "ingest_hybrid_started"
    assert result[0]["level"] == "info"
    assert result[0]["details"] == {"question": "How?"}
    assert result[0]["created_at"].startswith("2026-07-31")


@pytest.mark.asyncio
async def test_get_agent_events_no_org():
    from src.api.routes.activity import get_agent_events

    with patch("src.api.routes.activity.fetch_all", new_callable=AsyncMock) as mock_fetch:
        result = await get_agent_events(limit=50, token={})
    assert result == []
    mock_fetch.assert_not_awaited()
