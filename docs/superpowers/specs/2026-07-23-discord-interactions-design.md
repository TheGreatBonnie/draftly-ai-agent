# Design Spec: Discord Interactive Review Notifications

**Date:** 2026-07-23
**Status:** Draft
**Author:** opencode

## Summary

Add interactive Discord message components (buttons + select menus) to review notifications, matching the Slack Block Kit card experience. Currently Discord notifications are plain-text with a dashboard link — this change lets reviewers approve, reject, or revise directly from Discord without leaving the app.

## Motivation

Slack notifications have interactive Block Kit cards with approve/reject/revise buttons and a feedback dropdown. Discord notifications are plain text with only a dashboard link. This creates an inconsistent experience — Discord reviewers must open the web UI to take action, while Slack reviewers can act in-message.

## Scope

**In scope:**
- Interactive Discord message components (buttons + select menu) for review notifications
- Discord Interactions endpoint with Ed25519 signature verification
- Stateful message updates after action (replace original with result)
- Reuse existing HMAC review tokens for button values
- Tests for new components and interactions handler

**Out of scope:**
- Discord slash commands (`/approve`, `/reject`, `/revise`)
- Discord modals or popups
- Discord thread-based review conversations
- Bot guild membership management

## Architecture

### Current Flow (Plain Text)

```
human.py notify_reviewers()
  → discord.py send_discord_message(user_id, plain_text)
    → POST /api/v1/channels/{user_id}/messages  (plain text)
```

Reviewer reads → clicks dashboard link → takes action in web UI.

### New Flow (Interactive)

```
human.py notify_reviewers()
  → discord.py send_discord_message(user_id, embed=rich_embed)
    → POST /api/v1/channels/{user_id}/messages  (embed + components)

Reviewer clicks button → Discord sends interaction to /api/discord/interactions
  → Verify Ed25519 signature
  → Decode button custom_id (contains HMAC token)
  → Verify token, call complete_review()
  → Call resume_review() to resume LangGraph
  → Respond with updated message (replace_original)
```

## Components

### 1. Discord Embed Builder (`src/integrations/discord_blocks.py`)

Parallels `slack_blocks.py`. Builds a Discord embed payload with action rows.

**Discord embed structure:**
```json
{
  "embeds": [{
    "title": "Documentation Review Required",
    "description": "**Title:** {title}\n**Source:** {source}\n**Confidence:** {confidence}%",
    "color": 49407,
    "fields": [
      { "name": "Draft Preview", "value": "```{truncated_content}```", "inline": false }
    ],
    "footer": { "text": "Review expires in 24 hours" }
  }],
  "components": [
    {
      "type": 1,
      "components": [
        { "type": 2, "style": 3, "label": "Approve", "custom_id": "discord_approve:{token}" },
        { "type": 2, "style": 4, "label": "Reject", "custom_id": "discord_reject:{token}" },
        { "type": 2, "style": 2, "label": "Revise", "custom_id": "discord_revise:{token}" }
      ]
    },
    {
      "type": 1,
      "components": [
        { "type": 3, "custom_id": "discord_feedback:{token}", "placeholder": "Quick feedback",
          "options": [
            { "label": "Needs more context", "value": "needs_context" },
            { "label": "Formatting issues", "value": "formatting_issues" },
            { "label": "Content unclear", "value": "content_unclear" },
            { "label": "Missing information", "value": "missing_info" },
            { "label": "Minor edits needed", "value": "minor_edits" }
          ]
        }
      ]
    }
  ]
}
```

**Key design decisions:**
- Use `custom_id` format `discord_{action}:{hmac_token}` to encode action + token
- Use Discord embeds (not just content) for richer formatting with color coding
- Embed color `49407` (blue) for pending reviews, matching Slack's primary style
- Discord limits components to 5 action rows, 25 components per row — we use 2 rows (buttons + select)

### 2. Discord API Client Updates (`src/integrations/discord.py`)

Update `send_discord_message()` to accept an optional `embed` parameter:

```python
async def send_discord_message(
    channel_id: str,
    content: str | None = None,
    embed: dict | None = None,
    components: list[dict] | None = None,
) -> dict:
```

Add `edit_discord_message()` for updating messages after interaction:

```python
async def edit_discord_message(
    channel_id: str,
    message_id: str,
    content: str | None = None,
    embed: dict | None = None,
    components: list[dict] | None = None,
) -> dict:
```

### 3. Discord Interactions Endpoint (`src/api/routes/discord.py`)

New route module paralleling `slack.py`. Handles:

- **PONG response** for Discord ping/pong health checks
- **Component interactions** for button clicks and select menu selections
- **Ed25519 signature verification** using Discord's public key

**Endpoint:** `POST /api/discord/interactions`

**Interaction flow:**
1. Verify Ed25519 signature from `X-Signature-Ed25519` and `X-Signature-Timestamp` headers
2. Parse interaction payload
3. If type == 1 (PING) → respond `{"type": 1}` (PONG)
4. If type == 3 (MESSAGE_COMPONENT) → handle button/select:
   - Extract `custom_id` → split on `:` to get action + token
   - Verify HMAC token via `verify_review_token()`
   - Call `complete_review()` with appropriate status
   - Call `resume_review()` to resume LangGraph pipeline
   - Respond with `type: 7` (UPDATE_MESSAGE) containing updated embed

**Response format for UPDATE_MESSAGE:**
```json
{
  "type": 7,
  "data": {
    "content": "",
    "embeds": [{
      "title": "Documentation Review — Approved",
      "description": "...",
      "color": 3066993
    }],
    "components": []
  }
}
```

Color coding for results: green (3066993) for approved, red (15158332) for rejected, yellow (16776960) for needs_changes.

### 4. Human Node Updates (`src/agents/nodes/human.py`)

Update `notify_reviewers()` Discord branch to use the new embed builder instead of plain text:

```python
# Before
if reviewer.get("notify_discord") and reviewer.get("discord_user_id"):
    await send_discord_message(reviewer["discord_user_id"], plain_message)

# After
if reviewer.get("notify_discord") and reviewer.get("discord_user_id"):
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
```

### 5. Configuration Updates (`src/config.py`)

No new config fields needed — `discord_bot_token` and `discord_public_key` already exist.

### 6. Route Registration (`src/api/app.py`)

Add Discord router to the FastAPI app:

```python
from src.api.routes import discord
app.include_router(discord.router, prefix="/api/discord", tags=["discord"])
```

## Data Flow

```
1. Pipeline reaches human_review_node
2. notify_reviewers() iterates reviewers
3. For Discord-enabled reviewers:
   a. Generate HMAC token (existing: security/tokens.py)
   b. Build Discord embed + components (new: discord_blocks.py)
   c. Send via Discord API (updated: discord.py)
4. Reviewer sees interactive card in DM
5. Reviewer clicks Approve/Reject/Revise button
6. Discord sends POST to /api/discord/interactions
7. Handler verifies signature + token
8. complete_review() updates review_sessions table
9. resume_review() resumes LangGraph with decision
10. Handler responds with UPDATE_MESSAGE (type 7)
11. Original message updated to show result (green/red/yellow)
```

## Error Handling

| Error | Handling |
|-------|----------|
| Invalid Ed25519 signature | Return 401, log error, do not process |
| Expired/invalid HMAC token | Respond with ephemeral message "Token expired" |
| Discord API failure (send) | Log error, continue to next reviewer |
| Discord API failure (edit) | Log error, action already processed in DB |
| review_sessions not found | Respond with error message, log |
| resume_review failure | Log error, action already processed in DB |

## Testing Strategy

- **Unit tests:** discord_blocks.py builder (embed structure, truncation, color mapping)
- **Unit tests:** discord.py signature verification (valid, invalid, missing, malformed)
- **Integration tests:** /api/discord/interactions endpoint (PING, button click, select menu, invalid token)
- **Integration tests:** notify_reviewers() with Discord enabled (mock Discord API)

## Migration

No database changes needed. The `reviewers` table already has `discord_user_id`, `notify_discord` columns. The `review_sessions` and `security/tokens.py` infrastructure is already in place.
