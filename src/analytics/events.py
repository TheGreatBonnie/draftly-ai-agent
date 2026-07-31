"""Structured agent event capture — feeds dashboard telemetry.

A structlog processor snapshots every structured log event into an
in-memory buffer; a background asyncio task drains the buffer into the
``agent_events`` table in batches. The pipeline never blocks on or fails
because of analytics — capture is best-effort, fire-and-forget telemetry.
"""
from __future__ import annotations

import json
from collections import deque
from typing import Any

from src.config import settings

_MAX_STRING_LEN = 2000
_MAX_DETAILS_BYTES = 50_000
_RESERVED_KEYS = {"logger", "timestamp", "exc_info", "stack_info", "record"}


def _as_optional_str(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


class EventCollector:
    """Buffers structured log events for batched persistence.

    ``processor`` runs synchronously inside structlog (potentially on any
    thread); ``flush`` runs on the event loop. ``deque.append``/``clear``
    are atomic in CPython, so no lock is needed for telemetry.
    """

    def __init__(self, max_buffer_size: int = 500) -> None:
        self._buffer: deque[dict[str, Any]] = deque(maxlen=max_buffer_size)
        self._dropped = 0

    def processor(
        self,
        _logger: Any,
        _method_name: str,
        event_dict: dict[str, Any],
    ) -> dict[str, Any]:
        """structlog processor: snapshot each event before rendering."""
        if settings.event_capture_enabled:
            self._buffer.append(self._build_record(dict(event_dict)))
        return event_dict

    def _build_record(self, event_dict: dict[str, Any]) -> dict[str, Any]:
        org_id = _as_optional_str(event_dict.pop("org_id", None))
        workflow_id = _as_optional_str(event_dict.pop("workflow_id", None))
        event_type = str(event_dict.pop("event", "unknown"))
        level = str(event_dict.pop("level", "info"))
        details = self._sanitize(
            {key: value for key, value in event_dict.items() if key not in _RESERVED_KEYS}
        )
        if len(json.dumps(details, default=str)) > _MAX_DETAILS_BYTES:
            self._dropped += 1
            return {
                "org_id": org_id,
                "workflow_id": workflow_id,
                "event_type": event_type,
                "level": level,
                "details": {"dropped": True, "reason": "details_too_large"},
            }
        return {
            "org_id": org_id,
            "workflow_id": workflow_id,
            "event_type": event_type,
            "level": level,
            "details": details,
        }

    def _sanitize(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {key: self._sanitize(item) for key, item in value.items()}
        if isinstance(value, (list, tuple)):
            return [self._sanitize(item) for item in value]
        if isinstance(value, str) and len(value) > _MAX_STRING_LEN:
            return value[:_MAX_STRING_LEN] + "...[truncated]"
        return value
