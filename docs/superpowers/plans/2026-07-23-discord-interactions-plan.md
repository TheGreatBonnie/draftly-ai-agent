# Implementation Plan: Discord Interactive Review Notifications

**Date:** 2026-07-23
**Spec:** `docs/superpowers/specs/2026-07-23-discord-interactions-design.md`
**Status:** Ready to execute

## Overview

Add interactive Discord message components (buttons + select menus) to review notifications. 4 implementation units, ordered by dependency.

---

## Unit 1: Discord Embed Builder

**Goal:** Build Discord embed payloads with action buttons and feedback select menus.

**Files:**
- Create `src/integrations/discord_blocks.py`

**Implementation:**
1. Create `src/integrations/discord_blocks.py` with two functions:
   - `_truncate_draft(content: str, max_chars: int = 500) -> str` — reuse pattern from `slack_blocks.py:4-12`
   - `build_discord_review_card(title, source, confidence, dashboard_url, review_token, draft_content) -> dict` — returns `{"embeds": [...], "components": [...]}`

2. Build embed with:
   - `title`: "Documentation Review Required"
   - `description`: formatted with title, source, confidence
   - `color`: 49407 (blue) for pending
   - `fields`: draft preview in code block (truncated)
   - `footer`: "Review expires in 24 hours"

3. Build components array:
   - Row 1 (type 1): 3 buttons (Approve style 3/green, Reject style 4/red, Revise style 2/gray)
   - `custom_id` format: `discord_approve:{token}`, `discord_reject:{token}`, `discord_revise:{token}`
   - Row 2 (type 1): 1 select menu (type 3) with 5 feedback options, `custom_id`: `discord_feedback:{token}`

**Tests:**
- Create `tests/integrations/test_discord_blocks.py`
- Test embed structure (title, color, fields, footer)
- Test component structure (3 buttons + 1 select menu)
- Test truncation at 500 chars
- Test custom_id format contains token

**Verify:** `uv run pytest tests/integrations/test_discord_blocks.py -v`

---

## Unit 2: Discord API Client Updates

**Goal:** Update Discord client to support embeds, components, and message editing.

**Files:**
- Edit `src/integrations/discord.py`

**Implementation:**
1. Update `send_discord_message()` signature to accept optional `embed` and `components` parameters:
   ```python
   async def send_discord_message(
       channel_id: str,
       content: str | None = None,
       embed: dict | None = None,
       components: list[dict] | None = None,
   ) -> dict:
   ```
2. Build payload conditionally — include `content` only if provided, add `embeds` list if embed provided, add `components` if provided

3. Add new function `edit_discord_message()`:
   ```python
   async def edit_discord_message(
       channel_id: str,
       message_id: str,
       content: str | None = None,
       embed: dict | None = None,
       components: list[dict] | None = None,
   ) -> dict:
   ```
   - Uses `PATCH /api/v10/channels/{channel_id}/messages/{message_id}`
   - Same payload construction as send

4. Update `send_discord_thread_reply()` to also accept optional `embed` and `components`

**Tests:**
- Update `tests/integrations/test_discord_blocks.py` or create `tests/integrations/test_discord_client.py`
- Mock httpx, verify payload structure for send with embed+components
- Mock httpx, verify PATCH call for edit_discord_message
- Test send with only content (backward compatible)

**Verify:** `uv run pytest tests/integrations/ -v`

---

## Unit 3: Discord Interactions Endpoint

**Goal:** Handle Discord component interactions (button clicks, select menu) with Ed25519 verification.

**Files:**
- Create `src/api/routes/discord.py`
- Edit `src/api/app.py` (register router)

**Implementation:**
1. Create `src/api/routes/discord.py` with:

   a. `_verify_discord_signature(body, timestamp, signature, public_key) -> bool`:
      - Use `cryptography.hazmat.primitives.asymmetric.ed25519` for Ed25519 verification
      - Construct message = `timestamp + body`
      - Verify against `settings.discord_public_key`

   b. `POST /interactions` endpoint:
      - Read body, extract `X-Signature-Ed25519` and `X-Signature-Timestamp` headers
      - Verify signature, return 401 if invalid
      - Parse JSON payload
      - If `type == 1` (PING) → return `{"type": 1}`
      - If `type == 3` (MESSAGE_COMPONENT):
        - Extract `data.custom_id`
        - Split on `:` → action = `discord_approve` / `discord_reject` / `discord_revise` / `discord_feedback`
        - Extract token from custom_id
        - Call `verify_review_token(token)` → get `review_id`
        - Map action to status: approve→"approved", reject→"rejected", revise→"needs_changes", feedback→"needs_changes"
        - Call `complete_review(review_id, status, feedback)`
        - Call `resume_review(review_id, decision, feedback)`
        - Return `type: 7` (UPDATE_MESSAGE) with updated embed:
          - Color: 3066993 (green) for approved, 15158332 (red) for rejected, 16776960 (yellow) for needs_changes
          - Title: "Documentation Review — {status}"
          - Empty components (remove buttons after action)
      - Return 400 for unknown interaction types

2. Register in `src/api/app.py`:
   ```python
   from src.api.routes import discord
   app.include_router(discord.router, prefix="/api/discord", tags=["discord"])
   ```

**Dependencies to add:**
- `cryptography` (already in pyproject.toml via uv.lock? Check — may need to add)

**Tests:**
- Create `tests/api/test_discord_interactivity.py`
- Test PING response (type 1)
- Test valid button click → complete_review called, resume_review called, UPDATE_MESSAGE returned
- Test invalid signature → 401
- Test expired token → error response
- Test unknown interaction type → 400

**Verify:** `uv run pytest tests/api/test_discord_interactivity.py -v`

---

## Unit 4: Integrate into Human Node

**Goal:** Wire up the new Discord embed builder in the human review notification flow.

**Files:**
- Edit `src/agents/nodes/human.py`

**Implementation:**
1. In `notify_reviewers()` (line 13-80), update the Discord branch (lines 62-64):

   ```python
   # Before
   if reviewer.get("notify_discord") and reviewer.get("discord_user_id"):
       await send_discord_message(reviewer["discord_user_id"], plain_message)
       results.setdefault(reviewer["id"], {})["discord"] = "sent"

   # After
   if reviewer.get("notify_discord") and reviewer.get("discord_user_id"):
       from src.integrations.discord_blocks import build_discord_review_card
       embed_payload = build_discord_review_card(
           title=title, source=source, confidence=confidence,
           dashboard_url=review_page_url, review_token=token,
           draft_content=draft_content,
       )
       await send_discord_message(
           reviewer["discord_user_id"],
           embed=embed_payload["embeds"][0],
           components=embed_payload["components"],
       )
       results.setdefault(reviewer["id"], {})["discord"] = "sent"
   ```

2. The `plain_message` variable (lines 35-42) can remain as a fallback or be removed — the embed replaces it entirely.

**Tests:**
- Update `tests/test_notifications.py` to verify Discord branch sends embed+components
- Mock `send_discord_message`, verify `embed` kwarg is a dict with `title`, `color`, `fields`
- Verify `components` kwarg has 2 rows (buttons + select)

**Verify:** `uv run pytest tests/test_notifications.py -v`

---

## Execution Order

```
Unit 1 (discord_blocks.py)     ← no dependencies
Unit 2 (discord.py updates)    ← no dependencies, can parallel with Unit 1
Unit 3 (discord.py route)      ← depends on Unit 1 (uses build_discord_review_card)
Unit 4 (human.py integration)  ← depends on Units 1 + 2
```

Units 1 and 2 can be implemented in parallel. Unit 3 depends on Unit 1. Unit 4 depends on Units 1 and 2.

## Verification Checklist

After all units are complete:

```bash
# Lint
uv run ruff check src/

# Type check
uv run mypy src/

# Tests
uv run pytest tests/ -v

# Manual verification
# 1. Set DISCORD_BOT_TOKEN and DISCORD_PUBLIC_KEY in .env
# 2. Invite bot to Discord server
# 3. Create reviewer with discord_user_id + notify_discord=true
# 4. Run pipeline: uv run python -m src.cli.draftly "test question" --org-id <id>
# 5. Verify Discord DM received with interactive card
# 6. Click Approve → message updates to green "Approved"
```
