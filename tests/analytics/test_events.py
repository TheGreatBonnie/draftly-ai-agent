from unittest.mock import AsyncMock, patch

import pytest

from src.analytics.events import EventCollector


def make_collector() -> EventCollector:
    return EventCollector(max_buffer_size=10)


def test_processor_buffers_event():
    collector = make_collector()
    event_dict = {
        "event": "ingest_hybrid_started",
        "level": "info",
        "org_id": "org-1",
        "workflow_id": "w1",
        "question": "How?",
    }
    returned = collector.processor(None, "info", event_dict)

    assert returned is event_dict
    assert len(collector._buffer) == 1
    record = collector._buffer[0]
    assert record["event_type"] == "ingest_hybrid_started"
    assert record["level"] == "info"
    assert record["org_id"] == "org-1"
    assert record["workflow_id"] == "w1"
    assert record["details"] == {"question": "How?"}


def test_processor_strips_reserved_keys():
    collector = make_collector()
    collector.processor(
        None,
        "info",
        {
            "event": "e",
            "level": "info",
            "exc_info": ("exc", "inst", None),
            "logger": "x",
            "timestamp": "2026-07-31 00:00:00",
            "message": "hi",
        },
    )
    record = collector._buffer[0]
    assert record["details"] == {"message": "hi"}


def test_processor_truncates_long_strings():
    collector = make_collector()
    long = "x" * 5000
    collector.processor(None, "info", {"event": "e", "level": "info", "text_preview": long})
    record = collector._buffer[0]
    assert record["details"]["text_preview"].endswith("...[truncated]")
    assert len(record["details"]["text_preview"]) < 5000


def test_processor_drops_oversized_details():
    collector = make_collector()
    big = {f"k{i}": "v" * 2000 for i in range(100)}
    collector.processor(None, "info", {"event": "e", "level": "info", **big})
    record = collector._buffer[0]
    assert record["details"].get("dropped") is True


def test_processor_survives_unserializable_details():
    collector = make_collector()
    collector.processor(None, "info", {"event": "e", "level": "info", "bad": {(1, 2): "x"}})
    assert len(collector._buffer) == 1
    record = collector._buffer[0]
    assert record["details"] == {"dropped": True, "reason": "unserializable_details"}


def test_processor_does_not_mutate_event_dict():
    collector = make_collector()
    event_dict = {"event": "e", "level": "info", "org_id": "org-1", "question": "How?"}
    collector.processor(None, "info", event_dict)
    assert event_dict == {"event": "e", "level": "info", "org_id": "org-1", "question": "How?"}


@pytest.mark.asyncio
async def test_processor_respects_capture_disabled():
    collector = make_collector()
    with patch("src.analytics.events.settings") as mock_settings:
        mock_settings.event_capture_enabled = False
        collector.processor(None, "info", {"event": "e", "level": "info"})
    assert len(collector._buffer) == 0
