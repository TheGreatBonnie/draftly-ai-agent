# Slack Block Kit Notification Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plain text Slack notifications with rich Block Kit cards containing a truncated draft preview, interactive buttons, and a feedback dropdown.

**Architecture:** Create a Block Kit builder module with draft truncation logic, update the Slack integration to support blocks, modify the notification function to use the new card format, and add an interactivity endpoint to handle button clicks.

**Tech Stack:** Python, Slack Block Kit, FastAPI, pytest

---

## File Structure

| File | Purpose |
|------|---------|
| `src/integrations/slack_blocks.py` | **Create** - Block Kit JSON builder functions |
| `src/integrations/slack.py` | **Modify** - Add `blocks` parameter to `send_slack_message()` |
| `src/agents/nodes/human.py` | **Modify** - Build Block Kit card in `notify_reviewers()` |
| `src/api/routes/slack.py` | **Create** - Interactivity endpoint for button clicks |
| `src/api/app.py` | **Modify** - Register new Slack routes |
| `tests/integrations/test_slack_blocks.py` | **Create** - Unit tests for Block Kit builder |
| `tests/api/test_slack_interactivity.py` | **Create** - Tests for interactivity endpoint |
| `tests/test_notifications.py` | **Modify** - Update existing tests for new format |

---

### Task 1: Create Block Kit Builder Module

**Files:**
- Create: `src/integrations/slack_blocks.py`
- Create: `tests/integrations/test_slack_blocks.py`

- [ ] **Step 1: Write the failing test for block builder**

```python
# tests/integrations/test_slack_blocks.py
import pytest
from src.integrations.slack_blocks import build_review_notification_card


def test_build_review_notification_card_returns_valid_structure():
    card = build_review_notification_card(
        title="Fix authentication flow",
        source="GitHub Issue #142",
        confidence=0.85,
        dashboard_url="https://app.example.com/review/abc123",
        review_token="test_token_123",
        draft_content="# Fix Auth\n\nThis covers the auth flow changes for mobile.",
    )
    
    assert "blocks" in card
    assert "text" in card
    assert len(card["blocks"]) > 0
    assert card["text"].startswith("Documentation Review Required:")


def test_build_review_notification_card_includes_header():
    card = build_review_notification_card(
        title="Test Title",
        source="Slack",
        confidence=0.9,
        dashboard_url="https://example.com",
        review_token="token",
        draft_content="Some draft content here.",
    )
    
    header = card["blocks"][0]
    assert header["type"] == "header"
    assert "Documentation Review Required" in header["text"]["text"]


def test_build_review_notification_card_includes_metadata():
    card = build_review_notification_card(
        title="My Document",
        source="Jira",
        confidence=0.75,
        dashboard_url="https://example.com",
        review_token="token",
        draft_content="Some draft content.",
    )
    
    section = card["blocks"][1]
    assert section["type"] == "section"
    assert len(section["fields"]) == 3
    assert "My Document" in section["fields"][0]["text"]
    assert "Jira" in section["fields"][1]["text"]
    assert "75%" in section["fields"][2]["text"]


def test_build_review_notification_card_includes_draft_preview():
    card = build_review_notification_card(
        title="Test",
        source="Test",
        confidence=0.5,
        dashboard_url="https://example.com",
        review_token="token",
        draft_content="# Hello\n\nThis is the full draft content that should be truncated.",
    )
    
    draft_section = card["blocks"][2]
    assert draft_section["type"] == "section"
    assert "Draft Preview:" in draft_section["text"]["text"]
    assert "```markdown" in draft_section["text"]["text"]
    assert "Hello" in draft_section["text"]["text"]


def test_build_review_notification_card_truncates_long_draft():
    long_draft = "word " * 200  # 1000 chars
    card = build_review_notification_card(
        title="Test",
        source="Test",
        confidence=0.5,
        dashboard_url="https://example.com",
        review_token="token",
        draft_content=long_draft,
    )
    
    draft_section = card["blocks"][2]
    text = draft_section["text"]["text"]
    # Should be truncated (under 600 chars in the code block)
    assert len(text) < 700
    assert text.endswith("```")


def test_build_review_notification_card_empty_draft():
    card = build_review_notification_card(
        title="Test",
        source="Test",
        confidence=0.5,
        dashboard_url="https://example.com",
        review_token="token",
        draft_content="",
    )
    
    draft_section = card["blocks"][2]
    assert draft_section["type"] == "section"
    assert "Draft Preview:" in draft_section["text"]["text"]


def test_build_review_notification_card_includes_action_buttons():
    card = build_review_notification_card(
        title="Test",
        source="Test",
        confidence=0.5,
        dashboard_url="https://example.com",
        review_token="abc123",
        draft_content="content",
    )
    
    actions = [b for b in card["blocks"] if b["type"] == "actions"]
    assert len(actions) >= 2
    
    approve_btn = actions[1]["elements"][0]
    assert approve_btn["action_id"] == "approve_review"
    assert approve_btn["value"] == "abc123"
    assert approve_btn["style"] == "primary"
    
    reject_btn = actions[1]["elements"][1]
    assert reject_btn["action_id"] == "reject_review"
    assert reject_btn["style"] == "danger"


def test_build_review_notification_card_includes_feedback_dropdown():
    card = build_review_notification_card(
        title="Test",
        source="Test",
        confidence=0.5,
        dashboard_url="https://example.com",
        review_token="token",
        draft_content="content",
    )
    
    section = card["blocks"][-1]
    assert section["type"] == "section"
    assert section["accessory"]["type"] == "static_select"
    assert section["accessory"]["action_id"] == "feedback_select"
    assert len(section["accessory"]["options"]) == 5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/integrations/test_slack_blocks.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.integrations.slack_blocks'"

- [ ] **Step 3: Write minimal implementation**

```python
# src/integrations/slack_blocks.py
from __future__ import annotations


def _truncate_draft(content: str, max_chars: int = 500) -> str:
    """Truncate draft content to max_chars at a word boundary."""
    if len(content) <= max_chars:
        return content
    truncated = content[:max_chars]
    last_space = truncated.rfind(" ")
    if last_space > max_chars // 2:
        truncated = truncated[:last_space]
    return truncated + "..."


def build_review_notification_card(
    title: str,
    source: str,
    confidence: float,
    dashboard_url: str,
    review_token: str,
    draft_content: str = "",
) -> dict:
    """Build a Block Kit card for documentation review notifications."""
    truncated_draft = _truncate_draft(draft_content)
    draft_preview = f"*Draft Preview:*\n```markdown\n{truncated_draft}\n```"

    return {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📝 Documentation Review Required",
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Title:* {title}"},
                    {"type": "mrkdwn", "text": f"*Source:* {source}"},
                    {"type": "mrkdwn", "text": f"*Confidence:* {confidence:.0%}"},
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": draft_preview,
                },
            },
            {"type": "divider"},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Read Full Draft",
                            "emoji": True,
                        },
                        "url": dashboard_url,
                        "style": "primary",
                    },
                ],
            },
            {"type": "divider"},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "✅ Approve",
                            "emoji": True,
                        },
                        "action_id": "approve_review",
                        "value": review_token,
                        "style": "primary",
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "❌ Reject",
                            "emoji": True,
                        },
                        "action_id": "reject_review",
                        "value": review_token,
                        "style": "danger",
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "🔄 Revise",
                            "emoji": True,
                        },
                        "action_id": "revise_review",
                        "value": review_token,
                    },
                ],
            },
            {"type": "divider"},
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": "*Quick Feedback:*"},
                "accessory": {
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select feedback option",
                    },
                    "action_id": "feedback_select",
                    "options": [
                        {
                            "text": {"type": "plain_text", "text": "Needs more context"},
                            "value": "needs_context",
                        },
                        {
                            "text": {"type": "plain_text", "text": "Formatting issues"},
                            "value": "formatting_issues",
                        },
                        {
                            "text": {"type": "plain_text", "text": "Content unclear"},
                            "value": "content_unclear",
                        },
                        {
                            "text": {"type": "plain_text", "text": "Missing information"},
                            "value": "missing_info",
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "Looks good, minor edits needed",
                            },
                            "value": "minor_edits",
                        },
                    ],
                },
            },
        ],
        "text": f"Documentation Review Required: {title}",
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/integrations/test_slack_blocks.py -v`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/integrations/slack_blocks.py tests/integrations/test_slack_blocks.py
git commit -m "feat: add Block Kit card builder for review notifications"
```

---

### Task 2: Update Slack Integration to Support Blocks

**Files:**
- Modify: `src/integrations/slack.py`
- Create: `tests/integrations/test_slack_blocks_param.py`

- [ ] **Step 1: Write the failing test for blocks parameter**

```python
# tests/integrations/test_slack_blocks_param.py
import pytest
from unittest.mock import AsyncMock, patch
from src.integrations.slack import send_slack_message


@pytest.mark.asyncio
@patch("src.integrations.slack.client.chat_postMessage")
async def test_send_slack_message_with_blocks(mock_post):
    mock_post.return_value = {"ok": True}
    
    blocks = [{"type": "header", "text": {"type": "plain_text", "text": "Test"}}]
    
    await send_slack_message("C123", "Fallback text", blocks=blocks)
    
    mock_post.assert_called_once_with(
        channel="C123",
        text="Fallback text",
        blocks=blocks,
    )


@pytest.mark.asyncio
@patch("src.integrations.slack.client.chat_postMessage")
async def test_send_slack_message_without_blocks(mock_post):
    mock_post.return_value = {"ok": True}
    
    await send_slack_message("C123", "Simple message")
    
    mock_post.assert_called_once_with(
        channel="C123",
        text="Simple message",
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/integrations/test_slack_blocks_param.py -v`
Expected: FAIL with TypeError (unexpected keyword argument 'blocks')

- [ ] **Step 3: Read current slack.py implementation**

```bash
head -50 src/integrations/slack.py
```

- [ ] **Step 4: Write minimal implementation**

Update `send_slack_message()` signature to accept optional `blocks` parameter and pass it to the API call.

```python
# Add to function signature: blocks: list[dict] | None = None
# Add to API call: if blocks: kwargs["blocks"] = blocks
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/integrations/test_slack_blocks_param.py -v`
Expected: Both tests PASS

- [ ] **Step 6: Run all slack tests**

Run: `pytest tests/integrations/test_slack*.py -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/integrations/slack.py tests/integrations/test_slack_blocks_param.py
git commit -m "feat: add blocks parameter to send_slack_message"
```

---

### Task 3: Update notify_reviewers to Use Block Kit Card

**Files:**
- Modify: `src/agents/nodes/human.py`
- Modify: `tests/test_notifications.py`

- [ ] **Step 1: Write the failing test for new message format**

```python
# tests/test_notifications.py - add new test
@pytest.mark.asyncio
@patch("src.agents.nodes.human.send_slack_message")
@patch("src.agents.nodes.human.get_reviewers_by_org")
@patch("src.agents.nodes.human.generate_review_token")
async def test_notify_reviewers_sends_block_kit_card(
    mock_token, mock_reviewers, mock_slack
):
    mock_token.return_value = "test_token"
    mock_reviewers.return_value = [
        {
            "id": "rev1",
            "name": "Test Reviewer",
            "notify_slack": True,
            "slack_user_id": "U123",
        }
    ]
    mock_slack.return_value = None
    
    state = {
        "org_id": "org1",
        "draft_title": "Test Doc",
        "draft_content": "# Test\n\nThis is test content.",
        "confidence_score": 0.85,
        "source_type": "github",
    }
    
    await notify_reviewers(state, "review123")
    
    mock_slack.assert_called_once()
    call_args = mock_slack.call_args
    assert call_args[1].get("blocks") is not None or len(call_args[0]) > 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_notifications.py::test_notify_reviewers_sends_block_kit_card -v`
Expected: FAIL (currently sends plain text)

- [ ] **Step 3: Update notify_reviewers function**

Import the block builder and use it instead of plain text:

```python
from src.integrations.slack_blocks import build_review_notification_card

# Replace the message string with:
card = build_review_notification_card(
    title=title,
    source=source,
    confidence=confidence,
    dashboard_url=dashboard_url,
    review_token=token,
    draft_content=state.get("draft_content", ""),
)
await send_slack_message(reviewer["slack_user_id"], card["text"], blocks=card["blocks"])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_notifications.py::test_notify_reviewers_sends_block_kit_card -v`
Expected: PASS

- [ ] **Step 5: Run all notification tests**

Run: `pytest tests/test_notifications.py -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/agents/nodes/human.py tests/test_notifications.py
git commit -m "feat: use Block Kit card for Slack review notifications"
```

---

### Task 4: Create Interactivity Endpoint

**Files:**
- Create: `src/api/routes/slack.py`
- Create: `tests/api/test_slack_interactivity.py`

- [ ] **Step 1: Write the failing test for interactivity endpoint**

```python
# tests/api/test_slack_interactivity.py
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from src.api.app import app


client = TestClient(app)


@patch("src.api.routes.slack.verify_review_token")
@patch("src.api.routes.slack.complete_review")
def test_interactivity_approve_button(mock_complete, mock_verify_token):
    mock_verify_token.return_value = {"review_id": "review123", "user_id": "U123"}
    mock_complete.return_value = None
    
    payload = {
        "type": "block_actions",
        "user": {"id": "U123"},
        "actions": [
            {
                "action_id": "approve_review",
                "value": "test_token_123",
            }
        ],
        "container": {"message_ts": "1234567890"},
    }
    
    response = client.post(
        "/api/slack/interactivity",
        data={"payload": str(payload)},
    )
    
    assert response.status_code == 200


@patch("src.api.routes.slack.verify_review_token")
def test_interactivity_invalid_signature(mock_verify_token):
    mock_verify_token.return_value = None
    
    payload = {
        "type": "block_actions",
        "user": {"id": "U123"},
        "actions": [
            {
                "action_id": "approve_review",
                "value": "invalid_token",
            }
        ],
    }
    
    response = client.post(
        "/api/slack/interactivity",
        data={"payload": str(payload)},
    )
    
    assert response.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/api/test_slack_interactivity.py -v`
Expected: FAIL with 404 (route not found)

- [ ] **Step 3: Read existing review routes for reference**

```bash
head -100 src/api/routes/review.py
```

- [ ] **Step 4: Write the interactivity endpoint**

```python
# src/api/routes/slack.py
from __future__ import annotations

import json

from fastapi import APIRouter, Form, Request
from fastapi.responses import JSONResponse

from src.memory.reviewer import complete_review
from src.security.tokens import verify_review_token

router = APIRouter()


def verify_slack_signature(payload: str, signature: str, timestamp: str) -> bool:
    """Verify Slack request signature."""
    from src.config import settings
    import hmac
    import hashlib
    
    if not settings.slack_signing_secret:
        return True  # Skip verification if not configured
    
    basestring = f"v0:{timestamp}:{payload}"
    signature_hash = hmac.new(
        settings.slack_signing_secret.encode(),
        basestring.encode(),
        hashlib.sha256,
    ).hexdigest()
    
    return hmac.compare_digest(f"v0={signature_hash}", signature)


@router.post("/api/slack/interactivity")
async def handle_slack_interactivity(
    request: Request,
    payload: str = Form(...),
):
    """Handle Slack interactivity payloads (button clicks, dropdowns)."""
    form_data = await request.form()
    payload_str = form_data.get("payload", "{}")
    payload = json.loads(payload_str)
    
    # Handle block actions
    if payload.get("type") == "block_actions":
        actions = payload.get("actions", [])
        
        for action in actions:
            action_id = action.get("action_id")
            token = action.get("value")
            
            if action_id in ("approve_review", "reject_review", "revise_review"):
                decision = action_id.replace("_review", "")
                token_data = verify_review_token(token)
                if token_data:
                    review_id = token_data.get("review_id")
                    await complete_review(review_id, decision, "")
                
                return JSONResponse(
                    content={
                        "text": f"Review {decision}d successfully",
                        "replace_original": False,
                    }
                )
    
    return JSONResponse(content={})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/api/test_slack_interactivity.py -v`
Expected: Both tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/slack.py tests/api/test_slack_interactivity.py
git commit -m "feat: add Slack interactivity endpoint for review actions"
```

---

### Task 5: Register Slack Routes in App

**Files:**
- Modify: `src/api/app.py`

- [ ] **Step 1: Read current app.py to find router registration**

```bash
grep -n "router\|include_router" src/api/app.py
```

- [ ] **Step 2: Add Slack router import and registration**

```python
from src.api.routes.slack import router as slack_router

app.include_router(slack_router)
```

- [ ] **Step 3: Verify app starts**

Run: `python -c "from src.api.app import app; print('App loaded successfully')"`
Expected: "App loaded successfully"

- [ ] **Step 4: Commit**

```bash
git add src/api/app.py
git commit -m "feat: register Slack interactivity routes"
```

---

### Task 6: Run Full Test Suite

**Files:**
- None (verification step)

- [ ] **Step 1: Run all tests**

Run: `pytest -v`
Expected: All tests PASS

- [ ] **Step 2: Run linting**

Run: `ruff check src/ tests/`
Expected: No errors

- [ ] **Step 3: Run type checking**

Run: `mypy src/`
Expected: No type errors

- [ ] **Step 4: Final commit with any fixes**

```bash
git add -A
git commit -m "fix: address linting and type checking issues"
```

---

## Success Criteria

- [ ] Block Kit builder produces valid card structure
- [ ] Slack notifications display as rich cards with header, metadata, draft preview, and dividers
- [ ] Draft content is truncated to ~500 chars at word boundary
- [ ] "Read Full Draft" button links to dashboard
- [ ] Approve/Reject/Revise buttons trigger interactivity endpoint
- [ ] Feedback dropdown captures selection
- [ ] Interactivity endpoint processes actions correctly
- [ ] All existing tests pass
- [ ] New tests cover Block Kit builder, draft truncation, and interactivity
- [ ] Linting and type checking pass
