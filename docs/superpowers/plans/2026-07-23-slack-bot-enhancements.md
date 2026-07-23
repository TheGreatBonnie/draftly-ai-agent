# Slack Bot Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port conversational UX patterns from my-casey-agent into draftly's existing Slack integration — Socket Mode, conversation memory, streaming/assistant panel, App Home, and Slack MCP.

**Architecture:** Five independent modules that integrate with draftly's existing `AsyncApp` in `slack_app.py`. Each enhancement is isolated and testable. No changes to the LangGraph pipeline structure.

**Tech Stack:** `slack-bolt` (AsyncApp, AsyncSocketModeHandler), `slack-sdk` (WebClient, block models), `mcp` SDK (MCPServerStreamableHTTP), CockroachDB (asyncpg), FastAPI

---

## Task 1: Add `SLACK_APP_TOKEN` to Config

**Files:**
- Modify: `src/config.py:17-22`
- Modify: `.env.example:10-12`

- [ ] **Step 1: Add `slack_app_token` to Settings**

In `src/config.py`, add after line 19 (`slack_signing_secret`):

```python
slack_app_token: SecretStr = SecretStr("")
```

- [ ] **Step 2: Update `.env.example`**

Add after line 12 (`SLACK_SIGNING_SECRET=...`):

```
SLACK_APP_TOKEN=xapp-...
```

- [ ] **Step 3: Run lint**

Run: `uv run ruff check src/config.py`
Expected: PASS (no new errors)

- [ ] **Step 4: Commit**

```bash
git add src/config.py .env.example
git commit -m "feat(slack): add SLACK_APP_TOKEN to config for Socket Mode"
```

---

## Task 2: Socket Mode Entry Point

**Files:**
- Create: `src/integrations/slack_socket.py`
- Modify: `main.py`
- Test: `tests/integrations/test_slack_socket.py`

- [ ] **Step 1: Write the failing test**

Create `tests/integrations/test_slack_socket.py`:

```python
"""Tests for Socket Mode entry point."""
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_start_socket_mode_creates_handler():
    from src.integrations.slack_socket import start_socket_mode

    mock_handler = AsyncMock()
    with patch(
        "src.integrations.slack_socket.AsyncSocketModeHandler",
        return_value=mock_handler,
    ) as MockHandler, patch(
        "src.integrations.slack_socket.settings"
    ) as mock_settings:
        mock_settings.slack_app_token.get_secret_value.return_value = "xapp-test-token"

        await start_socket_mode()

        MockHandler.assert_called_once()
        mock_handler.start_async.assert_called_once()


@pytest.mark.asyncio
async def test_should_use_socket_mode_true():
    from src.integrations.slack_socket import should_use_socket_mode

    with patch("src.integrations.slack_socket.settings") as mock_settings:
        mock_settings.slack_app_token.get_secret_value.return_value = "xapp-real-token"
        assert should_use_socket_mode() is True


@pytest.mark.asyncio
async def test_should_use_socket_mode_false():
    from src.integrations.slack_socket import should_use_socket_mode

    with patch("src.integrations.slack_socket.settings") as mock_settings:
        mock_settings.slack_app_token.get_secret_value.return_value = ""
        assert should_use_socket_mode() is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/integrations/test_slack_socket.py -v`
Expected: FAIL with `ModuleNotFoundError` or `ImportError`

- [ ] **Step 3: Write implementation**

Create `src/integrations/slack_socket.py`:

```python
"""Socket Mode entry point for local development without ngrok."""
from __future__ import annotations

import structlog
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler

from src.config import settings
from src.integrations.slack_app import slack_app

logger = structlog.get_logger()


def should_use_socket_mode() -> bool:
    """Check if SLACK_APP_TOKEN is configured."""
    return bool(settings.slack_app_token.get_secret_value())


async def start_socket_mode() -> None:
    """Start the Slack app in Socket Mode (WebSocket, no public URL needed)."""
    token = settings.slack_app_token.get_secret_value()
    handler = AsyncSocketModeHandler(slack_app, token)
    logger.info("slack_socket_mode_starting")
    await handler.start_async()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/integrations/test_slack_socket.py -v`
Expected: PASS

- [ ] **Step 5: Update `main.py`**

Replace `main.py` with:

```python
"""Draftly AI — Entry point for the application."""

import asyncio

import uvicorn
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    uvicorn_host: str = "0.0.0.0"
    uvicorn_port: int = 8000


if __name__ == "__main__":
    from src.integrations.slack_socket import should_use_socket_mode

    if should_use_socket_mode():
        from src.integrations.slack_socket import start_socket_mode

        asyncio.run(start_socket_mode())
    else:
        settings = Settings()
        uvicorn.run(
            "src.api.app:app",
            host=settings.uvicorn_host,
            port=settings.uvicorn_port,
            reload=True,
        )
```

- [ ] **Step 6: Run lint and typecheck**

Run: `uv run ruff check src/integrations/slack_socket.py main.py`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/integrations/slack_socket.py main.py tests/integrations/test_slack_socket.py
git commit -m "feat(slack): add Socket Mode entry point for local development"
```

---

## Task 3: Conversation Memory — Migration

**Files:**
- Create: `infrastructure/cockroachdb/migrations/010_add_slack_conversations.sql`

- [ ] **Step 1: Create migration**

Create `infrastructure/cockroachdb/migrations/010_add_slack_conversations.sql`:

```sql
-- 010: Slack conversation history for thread-aware bot responses
CREATE TABLE IF NOT EXISTS slack_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id STRING NOT NULL,
    thread_ts STRING NOT NULL,
    role STRING NOT NULL CHECK (role IN ('user', 'assistant')),
    content STRING NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_conversations_lookup
    ON slack_conversations (channel_id, thread_ts, created_at);

CREATE INDEX IF NOT EXISTS idx_slack_conversations_cleanup
    ON slack_conversations (created_at);
```

- [ ] **Step 2: Commit**

```bash
git add infrastructure/cockroachdb/migrations/010_add_slack_conversations.sql
git commit -m "feat(slack): add migration for slack_conversations table"
```

---

## Task 4: Conversation Memory — Store Implementation

**Files:**
- Create: `src/integrations/slack_conversation.py`
- Test: `tests/integrations/test_slack_conversation.py`

- [ ] **Step 1: Write the failing test**

Create `tests/integrations/test_slack_conversation.py`:

```python
"""Tests for CockroachDB-backed conversation store."""
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_get_history_returns_messages():
    from src.integrations.slack_conversation import ConversationStore

    store = ConversationStore()
    mock_rows = [
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": "hi there"},
    ]

    with patch("src.integrations.slack_conversation.fetch_all", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = mock_rows
        result = await store.get_history("C123", "1234.5678")

        assert len(result) == 2
        assert result[0]["role"] == "user"
        assert result[1]["content"] == "hi there"
        mock_fetch.assert_called_once()


@pytest.mark.asyncio
async def test_add_message_inserts():
    from src.integrations.slack_conversation import ConversationStore

    store = ConversationStore()

    with patch("src.integrations.slack_conversation.execute", new_callable=AsyncMock) as mock_exec:
        await store.add_message("C123", "1234.5678", "user", "hello world")
        mock_exec.assert_called_once()


@pytest.mark.asyncio
async def test_cleanup_deletes_old_messages():
    from src.integrations.slack_conversation import ConversationStore

    store = ConversationStore()

    with patch("src.integrations.slack_conversation.execute", new_callable=AsyncMock) as mock_exec:
        await store.cleanup(ttl_days=30)
        mock_exec.assert_called_once()


@pytest.mark.asyncio
async def test_get_history_empty():
    from src.integrations.slack_conversation import ConversationStore

    store = ConversationStore()

    with patch("src.integrations.slack_conversation.fetch_all", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = []
        result = await store.get_history("C999", "9999.0000")
        assert result == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/integrations/test_slack_conversation.py -v`
Expected: FAIL with `ImportError`

- [ ] **Step 3: Write implementation**

Create `src/integrations/slack_conversation.py`:

```python
"""CockroachDB-backed conversation store for Slack thread context."""
from __future__ import annotations

import structlog

from src.database import execute, fetch_all

logger = structlog.get_logger()


class ConversationStore:
    """Stores and retrieves conversation history per (channel_id, thread_ts)."""

    async def get_history(
        self, channel_id: str, thread_ts: str, limit: int = 20
    ) -> list[dict[str, str]]:
        """Return conversation history for a thread, oldest first."""
        rows = await fetch_all(
            """SELECT role, content FROM slack_conversations
               WHERE channel_id = $1 AND thread_ts = $2
               ORDER BY created_at ASC LIMIT $3""",
            channel_id,
            thread_ts,
            limit,
        )
        return [{"role": r["role"], "content": r["content"]} for r in rows]

    async def add_message(
        self, channel_id: str, thread_ts: str, role: str, content: str
    ) -> None:
        """Store a single message in the conversation."""
        await execute(
            """INSERT INTO slack_conversations (channel_id, thread_ts, role, content)
               VALUES ($1, $2, $3, $4)""",
            channel_id,
            thread_ts,
            role,
            content,
        )
        logger.debug(
            "conversation_message_stored",
            channel_id=channel_id,
            thread_ts=thread_ts,
            role=role,
        )

    async def cleanup(self, ttl_days: int = 30) -> None:
        """Delete conversation messages older than ttl_days."""
        await execute(
            """DELETE FROM slack_conversations
               WHERE created_at < now() - ($1::INT || ' days')::INTERVAL""",
            ttl_days,
        )
        logger.info("conversation_cleanup_completed", ttl_days=ttl_days)


conversation_store = ConversationStore()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/integrations/test_slack_conversation.py -v`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `uv run ruff check src/integrations/slack_conversation.py`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/integrations/slack_conversation.py tests/integrations/test_slack_conversation.py
git commit -m "feat(slack): add CockroachDB-backed conversation store"
```

---

## Task 5: Conversation Memory — Integrate into Event Handlers

**Files:**
- Modify: `src/integrations/slack_app.py`
- Modify: `src/agents/runners/slack_runner.py`

- [ ] **Step 1: Integrate conversation store into `slack_app.py`**

Add import at top of `src/integrations/slack_app.py`:

```python
from src.integrations.slack_conversation import conversation_store
```

Update `_dispatch_message` to load history and store user message:

```python
async def _dispatch_message(event: dict, context: dict) -> None:
    """Common dispatch logic for mentions and DMs."""
    channel = event.get("channel", "")
    ts = event.get("ts", "")
    thread_ts = event.get("thread_ts") or ts
    text = event.get("text", "")
    user = event.get("user", "")
    team_id = context.get("team_id", "")
    bot_user_id = context.get("bot_user_id", "")

    clean_text = text.replace(f"<@{bot_user_id}>", "").strip()
    if not clean_text:
        return

    # Load conversation history and store user message
    history = await conversation_store.get_history(channel, thread_ts)
    await conversation_store.add_message(channel, thread_ts, "user", clean_text)

    asyncio.create_task(
        _run_pipeline(team_id, channel, thread_ts, ts, clean_text, user, history)
    )
    struct_logger.info("slack_message_received", team_id=team_id, channel=channel)
```

- [ ] **Step 2: Update `_run_pipeline` and `run_slack_pipeline` to pass history**

Update `_run_pipeline` in `slack_app.py`:

```python
async def _run_pipeline(
    team_id: str,
    channel: str,
    thread_ts: str,
    ts: str,
    text: str,
    user: str,
    message_history: list[dict[str, str]] | None = None,
) -> None:
    """Lazy import wrapper to avoid circular dependencies."""
    from src.agents.runners.slack_runner import run_slack_pipeline

    await run_slack_pipeline(
        team_id=team_id,
        channel=channel,
        thread_ts=thread_ts,
        ts=ts,
        text=text,
        user=user,
        message_history=message_history or [],
    )
```

Update `run_slack_pipeline` in `slack_runner.py` to accept and pass `message_history`:

Add parameter to function signature:

```python
async def run_slack_pipeline(
    team_id: str,
    channel: str,
    thread_ts: str,
    ts: str,
    text: str,
    user: str,
    message_history: list[dict[str, str]] | None = None,
) -> None:
```

Pass it into `build_slack_state` — add `"message_history": message_history or []` to the returned dict (add `message_history` key to `DocumentationState` in `state.py` first).

- [ ] **Step 3: Store assistant reply after pipeline completes**

In `slack_runner.py`, after the pipeline completes, store the bot's reply. Add after the workflow status update:

```python
from src.integrations.slack_conversation import conversation_store

# Store assistant reply in conversation memory
if result.get("draft_content"):
    await conversation_store.add_message(
        channel, thread_ts, "assistant", result["draft_content"][:2000]
    )
```

- [ ] **Step 4: Add `message_history` and `mcp_tools` to `DocumentationState`**

In `src/agents/state.py`, add after the `subagent_results` field (end of class):

```python
message_history: list[dict[str, str]]
mcp_tools: Any  # Slack MCP Server toolset, None if unavailable
```

Also add `Any` to the imports at the top of the file:

```python
from typing import Annotated, Any, Literal, TypedDict
```

- [ ] **Step 5: Run lint**

Run: `uv run ruff check src/integrations/slack_app.py src/agents/runners/slack_runner.py src/agents/state.py`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/integrations/slack_app.py src/agents/runners/slack_runner.py src/agents/state.py
git commit -m "feat(slack): integrate conversation memory into event handlers"
```

---

## Task 6: Emoji Reactions — Acknowledgment & Progress

**Files:**
- Modify: `src/integrations/slack_app.py`
- Modify: `src/agents/runners/slack_runner.py`
- Create: `src/integrations/slack_status.py`
- Test: `tests/integrations/test_slack_status.py`

- [ ] **Step 1: Write the failing test**

Create `tests/integrations/test_slack_status.py`:

```python
"""Tests for Slack status helpers (reactions, progress)."""
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_set_assistant_status():
    from src.integrations.slack_status import set_assistant_status

    mock_client = AsyncMock()
    await set_assistant_status(mock_client, "C123", "1234.5678", "Working...")

    mock_client.assistantAssistantThreadsSetStatus.assert_called_once_with(
        channel_id="C123",
        thread_ts="1234.5678",
        status="Working...",
    )


@pytest.mark.asyncio
async def test_set_assistant_status_swallows_error():
    from src.integrations.slack_status import set_assistant_status

    mock_client = AsyncMock()
    mock_client.assistantAssistantThreadsSetStatus.side_effect = Exception("not supported")

    # Should not raise
    await set_assistant_status(mock_client, "C123", "1234.5678", "Working...")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/integrations/test_slack_status.py -v`
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/integrations/slack_status.py`:

```python
"""Slack assistant panel status and progress reaction helpers."""
from __future__ import annotations

from typing import Any

import structlog

logger = structlog.get_logger()

PROGRESS_REACTIONS = {
    "research": "mag",
    "synthesize": "books",
    "write_docs": "pencil2",
    "ai_review": "robot_face",
    "human_review": "busts_in_silhouette",
    "complete": "white_check_mark",
}


async def set_assistant_status(
    client: Any, channel_id: str, thread_ts: str, status: str
) -> None:
    """Set the assistant panel status for a thread. Non-critical — swallows errors."""
    try:
        await client.assistantAssistantThreadsSetStatus(
            channel_id=channel_id,
            thread_ts=thread_ts,
            status=status,
        )
    except Exception:
        logger.debug("assistant_status_not_supported")


async def clear_assistant_status(client: Any, channel_id: str, thread_ts: str) -> None:
    """Clear the assistant panel status."""
    await set_assistant_status(client, channel_id, thread_ts, "")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/integrations/test_slack_status.py -v`
Expected: PASS

- [ ] **Step 5: Add emoji acknowledgment to `slack_app.py`**

In `_dispatch_message`, add `:eyes:` reaction before the pipeline task:

```python
from src.integrations.slack import add_reaction

async def _dispatch_message(event: dict, context: dict) -> None:
    channel = event.get("channel", "")
    ts = event.get("ts", "")
    ...
    clean_text = text.replace(f"<@{bot_user_id}>", "").strip()
    if not clean_text:
        return

    # Instant acknowledgment
    await add_reaction(channel, ts, "eyes")

    history = await conversation_store.get_history(channel, thread_ts)
    await conversation_store.add_message(channel, thread_ts, "user", clean_text)

    asyncio.create_task(
        _run_pipeline(team_id, channel, thread_ts, ts, clean_text, user, history)
    )
```

- [ ] **Step 6: Run lint**

Run: `uv run ruff check src/integrations/slack_status.py src/integrations/slack_app.py`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/integrations/slack_status.py src/integrations/slack_app.py tests/integrations/test_slack_status.py
git commit -m "feat(slack): add emoji acknowledgment and assistant panel status"
```

---

## Task 7: Feedback Buttons

**Files:**
- Create: `src/integrations/slack_feedback.py`
- Modify: `src/integrations/slack_app.py`
- Test: `tests/integrations/test_slack_feedback.py`

- [ ] **Step 1: Write the failing test**

Create `tests/integrations/test_slack_feedback.py`:

```python
"""Tests for Slack feedback buttons."""
import pytest


def test_build_feedback_blocks_structure():
    from src.integrations.slack_feedback import build_feedback_blocks

    blocks = build_feedback_blocks()
    assert len(blocks) >= 1
    # Should contain a section with feedback buttons
    block = blocks[0]
    assert block["type"] == "section"


@pytest.mark.asyncio
async def test_handle_feedback_logs():
    from unittest.mock import AsyncMock, patch
    from src.integrations.slack_feedback import handle_feedback

    mock_ack = AsyncMock()
    action = {"value": "good-feedback"}
    body = {"user": {"id": "U123"}}

    with patch("src.integrations.slack_feedback.struct_logger") as mock_logger:
        await handle_feedback(mock_ack, action, body)
        mock_ack.assert_called_once()
        mock_logger.info.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/integrations/test_slack_feedback.py -v`
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/integrations/slack_feedback.py`:

```python
"""Slack feedback buttons for bot responses."""
from __future__ import annotations

from typing import Any

import structlog
from slack_sdk.models.blocks import FeedbackButtonsElement, SectionBlock

logger = structlog.get_logger()


def build_feedback_blocks() -> list[dict[str, Any]]:
    """Build Block Kit blocks with thumbs up/down feedback buttons."""
    section = SectionBlock(
        text="Was this helpful?",
        accessory=FeedbackButtonsElement(action_id="draftly_feedback"),
    )
    return [section.to_dict()]


async def handle_feedback(ack: Any, action: dict, body: dict) -> None:
    """Handle feedback button clicks."""
    await ack()
    value = action.get("value", "")
    user_id = body.get("user", {}).get("id", "")
    logger.info("slack_feedback_received", value=value, user_id=user_id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/integrations/test_slack_feedback.py -v`
Expected: PASS

- [ ] **Step 5: Register action handler in `slack_app.py`**

Add import at top:

```python
from src.integrations.slack_feedback import handle_feedback
```

Add action handler:

```python
@slack_app.action("draftly_feedback")
async def handle_draftly_feedback(ack: Any, action: dict, body: dict) -> None:
    await handle_feedback(ack, action, body)
```

- [ ] **Step 6: Append feedback buttons to reply in `slack_runner.py`**

After the pipeline completes and the reply is posted, append feedback blocks. In `run_slack_pipeline`, after the `conversation_store.add_message` call:

```python
from src.integrations.slack_feedback import build_feedback_blocks
from src.integrations.slack import send_slack_message

# Resolve bot token for feedback message
feedback_token = None
if team_id:
    from src.integrations.slack_store import installation_store as inst_feed
    bot = await inst_feed.async_find_bot(enterprise_id=None, team_id=team_id)
    if bot:
        feedback_token = bot.bot_token

# Post feedback buttons as a follow-up
await send_slack_message(
    channel=channel,
    text="",
    thread_ts=thread_ts,
    blocks=build_feedback_blocks(),
    token=feedback_token,
)
```

- [ ] **Step 7: Run lint**

Run: `uv run ruff check src/integrations/slack_feedback.py src/integrations/slack_app.py`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/integrations/slack_feedback.py src/integrations/slack_app.py tests/integrations/test_slack_feedback.py
git commit -m "feat(slack): add feedback buttons to bot responses"
```

---

## Task 8: App Home Dashboard

**Files:**
- Create: `src/integrations/slack_home.py`
- Modify: `src/integrations/slack_app.py`
- Test: `tests/integrations/test_slack_home.py`

- [ ] **Step 1: Write the failing test**

Create `tests/integrations/test_slack_home.py`:

```python
"""Tests for App Home view builder."""
import pytest


def test_build_app_home_returns_view():
    from src.integrations.slack_home import build_app_home

    view = build_app_home(team_name="Acme Corp", pipeline_count=5)
    assert view["type"] == "home"
    assert "blocks" in view


def test_build_app_home_includes_team_name():
    from src.integrations.slack_home import build_app_home

    view = build_app_home(team_name="Test Workspace", pipeline_count=0)
    blocks_text = str(view["blocks"])
    assert "Test Workspace" in blocks_text


def test_build_app_home_suggested_prompts():
    from src.integrations.slack_home import build_suggested_prompts

    prompts = build_suggested_prompts()
    assert len(prompts) == 3
    assert all("text" in p for p in prompts)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/integrations/test_slack_home.py -v`
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/integrations/slack_home.py`:

```python
"""App Home view builder for the Draftly Slack bot."""
from __future__ import annotations

from typing import Any


def build_app_home(team_name: str = "", pipeline_count: int = 0) -> dict[str, Any]:
    """Build the App Home Block Kit view."""
    header_text = f"**Draftly** — Your AI documentation assistant"
    workspace_text = f"Workspace: {team_name}" if team_name else ""
    stats_text = f"Completed pipelines: {pipeline_count}"

    blocks: list[dict[str, Any]] = [
        {"type": "header", "text": {"type": "plain_text", "text": "Draftly"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": header_text}},
        {"type": "divider"},
    ]

    if workspace_text:
        blocks.append(
            {"type": "section", "text": {"type": "mrkdwn", "text": f"_{workspace_text}_"}}
        )

    blocks.append(
        {"type": "section", "text": {"type": "mrkdwn", "text": stats_text}}
    )

    blocks.append({"type": "divider"})

    blocks.append(
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    "Get started by mentioning me in a channel or sending a DM.\n"
                    "I'll generate documentation from your conversations."
                ),
            },
        }
    )

    return {"type": "home", "blocks": blocks}


def build_suggested_prompts() -> list[dict[str, str]]:
    """Build suggested prompts for the Messages tab."""
    return [
        {"text": "Generate docs for this conversation"},
        {"text": "Summarize the last messages"},
        {"text": "What's the status of my recent requests?"},
    ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/integrations/test_slack_home.py -v`
Expected: PASS

- [ ] **Step 5: Add `app_home_opened` handler to `slack_app.py`**

Add import at top:

```python
from src.integrations.slack_home import build_app_home, build_suggested_prompts
```

Add event handler:

```python
@slack_app.event("app_home_opened")
async def handle_app_home_opened(client: Any, event: dict, logger: Any) -> None:
    """Publish App Home view when user opens the Home tab."""
    tab = event.get("tab", "")
    if tab != "home":
        return

    user_id = event.get("user", "")
    team_id = event.get("view", {}).get("team_id", "")

    team_name = ""
    if team_id:
        installation = await installation_store.async_find_installation(None, team_id)
        if installation:
            team_name = installation.team_name or ""

    view = build_app_home(team_name=team_name)
    try:
        await client.views_publish(user_id=user_id, view=view)
    except Exception:
        logger.debug("views_publish_failed")
```

- [ ] **Step 6: Run lint**

Run: `uv run ruff check src/integrations/slack_home.py src/integrations/slack_app.py`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/integrations/slack_home.py src/integrations/slack_app.py tests/integrations/test_slack_home.py
git commit -m "feat(slack): add App Home dashboard with workspace status"
```

---

## Task 9: Slack MCP Integration

**Files:**
- Create: `src/integrations/slack_mcp.py`
- Modify: `pyproject.toml`
- Modify: `src/agents/runners/slack_runner.py`
- Modify: `src/agents/nodes/research.py`
- Test: `tests/integrations/test_slack_mcp.py`

- [ ] **Step 1: Add `mcp` dependency**

In `pyproject.toml`, add to `dependencies` list (after line 41):

```
"mcp>=1.0.0",
```

- [ ] **Step 2: Write the failing test**

Create `tests/integrations/test_slack_mcp.py`:

```python
"""Tests for Slack MCP Server client."""
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_get_slack_mcp_tools_returns_none_without_token():
    from src.integrations.slack_mcp import get_slack_mcp_tools

    result = await get_slack_mcp_tools("")
    assert result is None


@pytest.mark.asyncio
async def test_get_slack_mcp_tools_returns_server_with_token():
    from src.integrations.slack_mcp import get_slack_mcp_tools

    with patch("src.integrations.slack_mcp.MCPServerStreamableHTTP") as MockServer:
        MockServer.return_value = AsyncMock()
        result = await get_slack_mcp_tools("xoxp-test-token")
        assert result is not None
        MockServer.assert_called_once_with(
            url="https://mcp.slack.com/mcp",
            headers={"Authorization": "Bearer xoxp-test-token"},
        )
```

- [ ] **Step 3: Run test to verify it fails**

Run: `uv run pytest tests/integrations/test_slack_mcp.py -v`
Expected: FAIL

- [ ] **Step 4: Write implementation**

Create `src/integrations/slack_mcp.py`:

```python
"""Slack MCP Server client for user-context operations."""
from __future__ import annotations

from typing import Any

import structlog

logger = structlog.get_logger()

SLACK_MCP_URL = "https://mcp.slack.com/mcp"


async def get_slack_mcp_tools(user_token: str) -> Any | None:
    """Return an MCP toolset connected to Slack's MCP Server, or None if no user token."""
    if not user_token:
        return None

    try:
        from mcp import MCPServerStreamableHTTP

        server = MCPServerStreamableHTTP(
            url=SLACK_MCP_URL,
            headers={"Authorization": f"Bearer {user_token}"},
        )
        logger.info("slack_mcp_connected")
        return server
    except ImportError:
        logger.warning("mcp_sdk_not_installed")
        return None
    except Exception as e:
        logger.error("slack_mcp_connection_failed", error=str(e))
        return None
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/integrations/test_slack_mcp.py -v`
Expected: PASS

- [ ] **Step 6: Integrate MCP into `slack_runner.py`**

Add MCP tool resolution in `run_slack_pipeline`, after `org` is resolved:

```python
from src.integrations.slack_mcp import get_slack_mcp_tools

# Resolve MCP tools if user token is available
mcp_tools = None
if team_id:
    from src.integrations.slack_store import installation_store as inst_store
    installation = await inst_store.async_find_installation(None, team_id)
    if installation and installation.user_token:
        mcp_tools = await get_slack_mcp_tools(installation.user_token)
```

Pass `mcp_tools` into `build_slack_state` as `"mcp_tools": mcp_tools`.

Note: `mcp_tools` was already added to `DocumentationState` in Task 5, Step 4.

- [ ] **Step 7: Use MCP in `research_node_hybrid`**

In `src/agents/nodes/research.py`, add after the existing Slack search section (around line 65):

```python
# Use MCP for richer Slack search if available
mcp_tools = state.get("mcp_tools")
if mcp_tools:
    try:
        mcp_search = await mcp_tools.call_tool(
            "search_messages",
            {"query": question, "count": 5},
        )
        if mcp_search:
            slack_context.append(f"MCP search results: {mcp_search}")
    except Exception as e:
        logger.warning("slack_mcp_search_failed", error=str(e))
```

- [ ] **Step 8: Update mypy override for `mcp`**

In `pyproject.toml`, update the existing `[[tool.mypy.overrides]]` section to include `mcp`:

```toml
[[tool.mypy.overrides]]
module = ["slack_bolt.*", "slack_sdk.*", "discord.*", "mcp.*"]
ignore_missing_imports = true
```

- [ ] **Step 9: Run lint**

Run: `uv run ruff check src/integrations/slack_mcp.py src/agents/runners/slack_runner.py src/agents/nodes/research.py`
Expected: PASS

- [ ] **Step 10: Install deps and run all tests**

Run: `uv sync && uv run pytest tests/integrations/test_slack_mcp.py -v`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add pyproject.toml src/integrations/slack_mcp.py src/agents/runners/slack_runner.py src/agents/nodes/research.py src/agents/state.py tests/integrations/test_slack_mcp.py
git commit -m "feat(slack): add Slack MCP Server integration for user-context search"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run full lint**

Run: `uv run ruff check src/`
Expected: PASS

- [ ] **Step 2: Run full typecheck**

Run: `uv run mypy src/`
Expected: PASS (with existing ignores for slack/mcp modules)

- [ ] **Step 3: Run all tests**

Run: `uv run pytest`
Expected: PASS

- [ ] **Step 4: Verify new files exist**

```bash
ls -la src/integrations/slack_socket.py \
       src/integrations/slack_conversation.py \
       src/integrations/slack_status.py \
       src/integrations/slack_feedback.py \
       src/integrations/slack_home.py \
       src/integrations/slack_mcp.py \
       infrastructure/cockroachdb/migrations/010_add_slack_conversations.sql
```

Expected: All files exist

- [ ] **Step 5: Final commit if needed**

```bash
git status
# If any unstaged changes, review and commit
```
