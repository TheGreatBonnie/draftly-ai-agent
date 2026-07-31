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


@pytest.mark.asyncio
async def test_flush_stores_buffered_events():
    collector = make_collector()
    collector.processor(None, "info", {"event": "e1", "level": "info", "org_id": "org-1"})
    collector.processor(None, "error", {"event": "e2", "level": "error"})

    with patch("src.analytics.events._store_events", new_callable=AsyncMock) as mock_store:
        count = await collector.flush()

    assert count == 2
    mock_store.assert_awaited_once()
    events = mock_store.await_args.args[0]
    assert [e["event_type"] for e in events] == ["e1", "e2"]
    assert len(collector._buffer) == 0


@pytest.mark.asyncio
async def test_flush_empty_buffer():
    collector = make_collector()
    with patch("src.analytics.events._store_events", new_callable=AsyncMock) as mock_store:
        count = await collector.flush()
    assert count == 0
    mock_store.assert_not_awaited()


@pytest.mark.asyncio
async def test_flush_error_does_not_raise():
    collector = make_collector()
    collector.processor(None, "info", {"event": "e1", "level": "info"})
    with patch("src.analytics.events._store_events", side_effect=Exception("DB down")):
        count = await collector.flush()
    assert count == 0
    assert len(collector._buffer) == 0


@pytest.mark.asyncio
async def test_store_events_uses_executemany():
    from src.analytics.events import _store_events

    pool = AsyncMock()
    with patch("src.analytics.events.get_pool", new_callable=AsyncMock, return_value=pool):
        await _store_events(
            [
                {
                    "org_id": "org-1",
                    "workflow_id": None,
                    "event_type": "e1",
                    "level": "info",
                    "details": {"a": 1},
                }
            ]
        )
    pool.executemany.assert_awaited_once()
    rows = pool.executemany.await_args.args[1]
    assert rows[0][0] == "org-1"
    assert rows[0][4] == '{"a": 1}'


def test_processor_skips_self_telemetry_events():
    collector = make_collector()
    collector.processor(None, "info", {"event": "events_flushed", "level": "info", "count": 5})
    collector.processor(
        None, "error", {"event": "event_flush_failed", "level": "error", "error": "DB down"}
    )
    collector.processor(
        None, "error", {"event": "event_flush_loop_failed", "level": "error"}
    )
    collector.processor(None, "info", {"event": "normal_event", "level": "info"})
    assert len(collector._buffer) == 1
    assert collector._buffer[0]["event_type"] == "normal_event"


def test_configure_logging_installs_processor():
    import structlog

    from src.analytics import events as events_module

    events_module.configure_logging()
    processors = structlog.get_config()["processors"]
    assert processors[-2] == events_module.collector.processor
    assert isinstance(processors[-1], structlog.dev.ConsoleRenderer)


@pytest.mark.asyncio
async def test_start_flusher_idempotent():
    from src.analytics import events as events_module

    await events_module.stop_flusher()
    await events_module.start_flusher()
    first = events_module._flush_task
    assert first is not None
    await events_module.start_flusher()
    assert events_module._flush_task is first
    await events_module.stop_flusher()
    assert events_module._flush_task is None


@pytest.mark.asyncio
async def test_stop_flusher_flushes_pending():
    from src.analytics import events as events_module

    await events_module.stop_flusher()
    pending = EventCollector(max_buffer_size=10)
    pending.processor(None, "info", {"event": "e1", "level": "info"})

    with (
        patch.object(events_module, "collector", pending),
        patch("src.analytics.events._store_events", new_callable=AsyncMock) as mock_store,
    ):
        await events_module.stop_flusher()

    mock_store.assert_awaited_once()


@pytest.mark.asyncio
async def test_start_flusher_restarts_after_task_completion():
    import asyncio

    from src.analytics import events as events_module

    await events_module.stop_flusher()
    await events_module.start_flusher()
    first = events_module._flush_task
    assert first is not None
    first.cancel()
    try:
        await first
    except asyncio.CancelledError:
        pass
    await events_module.start_flusher()
    assert events_module._flush_task is not None
    assert events_module._flush_task is not first
    await events_module.stop_flusher()
