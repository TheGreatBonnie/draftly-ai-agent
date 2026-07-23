# Design Spec: Slack Support Requests Solution Workflow

**Date:** 2026-07-23
**Status:** Draft
**Author:** opencode

## Summary

Add end-to-end Slack support request processing: when a user @mentions the bot or posts in a bot-connected channel, the system ingests the message, runs the 8-node LangGraph pipeline, and replies with generated documentation. Uses Slack Bolt for Python for OAuth, event handling, and interactivity, integrated into the existing FastAPI app via the ASGI adapter.

## Motivation

The GitHub issue workflow is fully implemented — a new issue triggers the full pipeline and posts generated docs back as a comment. Slack has all the downstream pieces (reply, notifications, interactivity, search tools) but is missing the upstream trigger and orchestration layer. This closes the gap so Slack support requests flow through the same AI pipeline as GitHub issues.

## Scope

**In scope:**
- Slack OAuth workspace installation via Bolt (`AsyncApp` + `OAuthSettings`)
- Custom `AsyncInstallationStore` backed by CockroachDB (`slack_installations` table)
- Slack Events API webhook handler for `message` events (via Bolt)
- Trigger on @mention or DM (no trigger on ambient channel messages)
- `slack_runner.py` orchestrator mirroring `github_runner.py`
- `slack_workflows` table for pipeline run tracking
- Wire existing `search_slack_messages` tool into research node
- Reply to Slack thread on publish (already exists, needs token resolution)
- Frontend Settings page Slack integration section
- Tests for runner, store, and Bolt integration

**Out of scope:**
- Socket Mode (dev-only concern, can be added later)
- Slack slash commands (`/draftly`, `/approve`)
- Slack App Home / Tab views
- Ambient channel monitoring (only @mentions + DMs)
- Multi-workspace Slack Connect handling
- Slack workflow builder integration

## Architecture

### Current State

```
GitHub:  Webhook → github_runner.py → 8-node pipeline → publish node → reply to issue
Slack:   (no trigger) → ... → publish node → _reply_to_slack() (exists but unreachable)
```

### Target State

```
Slack:   Bolt Events API → slack_runner.py → 8-node pipeline → publish node → reply to thread
```

### Data Flow

```
User @mentions bot in Slack channel
         │
         ▼
┌─────────────────────────────────────────┐
│  Bolt Event Handler                     │
│  src/integrations/slack_app.py          │
│                                         │
│  @slack_app.event("message")            │
│  1. Bolt verifies signature (built-in)  │
│  2. Bolt deduplicates event (built-in)  │
│  3. Check @mention or DM                │
│  4. Clean bot mention from text         │
│  5. asyncio.create_task(pipeline)       │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Slack Runner                           │
│  src/agents/runners/slack_runner.py     │
│                                         │
│  1. get_org_by_slack(team_id)           │
│  2. build_slack_state()                 │
│  3. Compile LangGraph + checkpointer    │
│  4. Store slack_workflows record        │
│  5. graph.ainvoke(state, config)        │
│  6. Update workflow status              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  8-Node LangGraph Pipeline              │
│                                         │
│  ingest → memory_retrieve → research    │
│    → synthesize → write_docs            │
│    → ai_review → human_review → publish │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Publish Node                           │
│  src/agents/nodes/publish.py            │
│                                         │
│  _reply_to_slack() posts generated      │
│  documentation as thread reply          │
└─────────────────────────────────────────┘
```

## Components

### 1. Database Migration

**New file:** `infrastructure/cockroachdb/migrations/009_add_slack_tables.sql`

**`slack_installations` table** — Stores Bolt OAuth installation data per workspace:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `org_id` | STRING FK | References `organizations(clerk_org_id)` |
| `team_id` | STRING UNIQUE | Slack workspace team ID (e.g., `T01234567`) |
| `team_name` | STRING | Workspace name |
| `enterprise_id` | STRING | Enterprise grid ID (nullable) |
| `bot_user_id` | STRING | Bot's user ID in workspace |
| `bot_token` | STRING | `xoxb-` bot token |
| `bot_scopes` | JSONB | Granted bot scopes |
| `access_token` | STRING | User access token (nullable) |
| `user_id` | STRING | Installing user ID (nullable) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**`slack_workflows` table** — Pipeline run tracking:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `org_id` | STRING FK | References `organizations(clerk_org_id)` |
| `workflow_id` | UUID | Pipeline run ID |
| `team_id` | STRING | Slack workspace ID |
| `channel_id` | STRING | Channel where message was posted |
| `thread_ts` | STRING | Thread timestamp (message ID) |
| `user_id` | STRING | User who sent the message |
| `status` | STRING | pending/running/completed/failed |
| `created_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | |

### 2. Configuration

**File:** `src/config.py`

Add three settings:

```python
slack_client_id: str = ""
slack_client_secret: SecretStr = SecretStr("")
slack_redirect_uri: str = "http://localhost:8000/slack/oauth_redirect"
```

Existing `slack_bot_token` and `slack_signing_secret` remain. Bolt uses `slack_signing_secret` for request verification. Per-workspace `bot_token` lives in `slack_installations` managed by Bolt's `InstallationStore`.

### 3. Custom `AsyncInstallationStore` (`src/integrations/slack_store.py`)

Implements Bolt's `AsyncInstallationStore` interface backed by CockroachDB.

**Required methods:**
- `async_save(installation)` — Store after OAuth callback
- `async_find_bot(enterprise_id, team_id, is_enterprise_install)` — Lookup bot token (called on every event)
- `async_delete_bot(enterprise_id, team_id)` — Handle uninstall
- `async_delete_all(enterprise_id, team_id)` — Cascading delete

**Critical:** Set `installation_store_bot_only=True` on `AsyncApp` to use `async_find_bot` instead of `async_find_installation`. Without this, Bolt returns "installation no longer available" errors (Bolt issue #1030).

### 4. Bolt App Setup (`src/integrations/slack_app.py`)

```python
slack_app = AsyncApp(
    signing_secret=settings.slack_signing_secret.get_secret_value(),
    oauth_settings=AsyncOAuthSettings(
        client_id=settings.slack_client_id,
        client_secret=settings.slack_client_secret.get_secret_value(),
        scopes=["channels:history", "channels:read", "chat:write",
                 "users:read", "groups:read", "im:read", "im:write"],
        installation_store=CockroachInstallationStore(),
        installation_store_bot_only=True,
        redirect_uri_path="/slack/oauth_redirect",
    ),
)
```

**OAuth scopes:**
- `channels:history` — Read messages in public channels
- `channels:read` — List channels
- `chat:write` — Post messages (reply with docs)
- `users:read` — Resolve user IDs
- `groups:read` — Read messages in private channels
- `im:read` — Read DMs
- `im:write` — Send DMs

### 5. Event Handlers (`src/integrations/slack_app.py`)

```python
@slack_app.event("message")
async def handle_message(event, context, logger):
    channel = event.get("channel", "")
    ts = event.get("ts", "")
    thread_ts = event.get("thread_ts", ts)
    text = event.get("text", "")
    user = event.get("user", "")
    team_id = context.team_id
    bot_user_id = context.bot_user_id

    is_mentioned = f"<@{bot_user_id}>" in text
    is_dm = channel.startswith("D")

    if not is_mentioned and not is_dm:
        return

    clean_text = text.replace(f"<@{bot_user_id}>", "").strip()
    asyncio.create_task(run_slack_pipeline(
        team_id=team_id, channel=channel, thread_ts=thread_ts,
        ts=ts, text=clean_text, user=user,
    ))
```

**What Bolt handles:**
- Signature verification (built-in, no manual HMAC)
- Event deduplication (tracks `event_id`)
- `url_verification` challenge response
- Bot message filtering (excludes `subtype: bot_message`)

**What we filter:**
- @mention check (`<@{bot_user_id}>` in text)
- DM check (`channel.startswith("D")`)

### 6. Interactivity Handlers (`src/integrations/slack_app.py`)

Replace the existing manual handler in `src/api/routes/slack.py`:

```python
@slack_app.action("approve_review")
async def handle_approve(ack, body, action):
    await ack()
    token_data = verify_review_token(action.get("value", ""))
    if token_data:
        review_id = token_data["review_id"]
        await complete_review(review_id=review_id, status="approved")
        await resume_review(review_id=review_id, decision="approve")

@slack_app.action("reject_review")
async def handle_reject(ack, body, action):
    await ack()
    token_data = verify_review_token(action.get("value", ""))
    if token_data:
        review_id = token_data["review_id"]
        await complete_review(review_id=review_id, status="rejected")
        await resume_review(review_id=review_id, decision="reject")

@slack_app.action("revise_review")
async def handle_revise(ack, body, action):
    await ack()
    token_data = verify_review_token(action.get("value", ""))
    if token_data:
        review_id = token_data["review_id"]
        await complete_review(review_id=review_id, status="needs_changes")
        await resume_review(review_id=review_id, decision="revise")
```

### 7. FastAPI Route Rewrite (`src/api/routes/slack.py`)

The existing 104-line file becomes a thin Bolt passthrough (~20 lines):

```python
from slack_bolt.adapter.fastapi import SlackRequestHandler
from src.integrations.slack_app import slack_app

handler = SlackRequestHandler(slack_app)

@router.post("/events")
async def slack_events(request: Request) -> Response:
    return await handler.handle(request)

@router.post("/interactivity")
async def slack_interactivity(request: Request) -> Response:
    return await handler.handle(request)

@router.get("/install")
async def slack_install(request: Request) -> Response:
    return await handler.handle(request)

@router.get("/oauth_redirect")
async def slack_oauth_redirect(request: Request) -> Response:
    return await handler.handle(request)
```

**Route mapping:**
- `POST /api/slack/events` — Bolt message handlers
- `POST /api/slack/interactivity` — Bolt action handlers
- `GET /api/slack/install` — Bolt renders "Add to Slack" page
- `GET /api/slack/oauth_redirect` — Bolt handles OAuth callback

### 8. Slack Runner (`src/agents/runners/slack_runner.py`)

Mirrors `github_runner.py`. Builds `DocumentationState` from Slack event, compiles LangGraph with CockroachDB checkpointer, invokes the 8-node pipeline.

**State builder:**
```python
def build_slack_state(team_id, channel, thread_ts, ts, text, user, org_id):
    graph_thread_id = f"slack-{channel}-{thread_ts}"
    return {
        "org_id": org_id,
        "source": "slack",
        "channel_id": channel,
        "thread_id": thread_ts,
        "graph_thread_id": graph_thread_id,
        "question": text,  # or first message of thread
        "source_metadata": {
            "team_id": team_id,
            "channel": channel,
            "thread_ts": thread_ts,
            "ts": ts,
            "user_id": user,
        },
        # ... all default fields initialized ...
    }
```

**Pipeline orchestrator:**
1. `get_org_by_slack(team_id)` — Look up org
2. `build_slack_state()` — Build initial state
3. Compile graph with checkpointer
4. `store_slack_workflow()` — Track run
5. `graph.ainvoke()` — Run pipeline
6. Update workflow status
7. On error: post error reply to Slack thread

### 9. Research Node Wiring (`src/agents/nodes/research.py`)

After the web search loop, add source-specific Slack search:

```python
slack_context = []
if state.get("source") == "slack":
    from src.agents.tools.slack_tools import search_slack_messages
    try:
        result = await search_slack_messages.ainvoke({"query": question, "limit": 3})
        if result and "No relevant" not in result:
            slack_context = [result]
    except Exception as e:
        logger.warning("slack_search_failed", error=str(e))
```

This fills the `slack_context` field that the synthesize prompt already consumes.

### 10. Publish Node Token Resolution (`src/agents/nodes/publish.py`)

Modify `_reply_to_slack()` to resolve the workspace-specific bot token via Bolt's `InstallationStore`:

```python
async def _reply_to_slack(state, metadata):
    channel = metadata["channel"]
    thread_ts = metadata.get("thread_ts")
    team_id = metadata.get("team_id")
    body = _build_reply_body(state)

    token = None
    if team_id:
        from src.integrations.slack_store import installation_store
        bot = await installation_store.async_find_bot(
            enterprise_id=None, team_id=team_id
        )
        if bot:
            token = bot.bot_token

    await send_slack_message(channel=channel, text=body, thread_ts=thread_ts, token=token)
```

Requires adding optional `token` parameter to `send_slack_message()` in `src/integrations/slack.py`.

### 11. DB Layer Functions (`src/memory/organizations.py`)

```python
async def get_org_by_slack(team_id: str) -> dict | None:
    """Find org by Slack team_id via slack_installations."""

async def store_slack_workflow(
    org_id: str, workflow_id: str, team_id: str,
    channel_id: str, thread_ts: str, user_id: str | None = None,
) -> str:

async def update_slack_workflow_status(workflow_id: str, status: str) -> None:

async def list_slack_installations() -> list[dict]:
```

### 12. Bugfix (`src/agents/nodes/human.py:24`)

```python
# Before:
source = str(state.get("source_type", "unknown"))
# After:
source = str(state.get("source", "unknown"))
```

### 13. Frontend

**New file:** `frontend/src/api/slack.ts` — API client (`listSlackInstallations()`)

**File:** `frontend/src/api/types.ts` — Add `SlackInstallation` interface

**File:** `frontend/src/pages/Settings.tsx` — Add "Slack Integration" section:
- "Connect Slack Workspace" button linking to `/api/slack/install`
- List of connected workspaces with team name and status

### 14. Custom OAuth Flow (Bolt OAuth Replaced)

**Why:** Bolt's built-in OAuth flow stores state in a `FileOAuthStateStore` and validates via a browser cookie (`slack-app-oauth-state`). The cookie gets lost when the install page opens in a `target="_blank"` tab through a reverse proxy (Tailscale), causing a 400 on every callback.

**Solution:** Replace Bolt's OAuth with a custom flow matching GitHub's pattern:
1. `GET /api/slack/install-url` — Returns Slack OAuth authorization URL
2. `GET /api/slack/oauth/callback` — Exchanges code for tokens, saves installation, redirects to frontend
3. Frontend auto-links installation via `POST /api/slack/link`

Bolt is kept only for event/interactivity signature verification (Events API, button clicks).

## Error Handling

| Error | Handling |
|---|---|
| Unknown team_id (no installation) | Log warning, ignore event |
| Bot not mentioned in channel message | Ignore event (no trigger) |
| Pipeline failure | Post error reply to Slack thread |
| InstallationStore lookup failure | Bolt returns "installation not available" |
| Token expiry | Bolt handles refresh if `token_rotation_expiration_minutes` set |
| Slack API rate limit | httpx timeout + retry (existing pattern) |

## Testing Strategy

- **Unit tests:** `slack_store.py` (save/find/delete), `slack_runner.py` (state builder)
- **Integration tests:** Bolt event routing (POST /events), action routing (POST /interactivity)
- **Mock tests:** `run_slack_pipeline` invocation from event handler

## Files Changed

### Backend (Python)
- `infrastructure/cockroachdb/migrations/009_add_slack_tables.sql` — **new** migration
- `src/config.py` — add `slack_client_id`, `slack_client_secret`, `slack_redirect_uri`
- `src/integrations/slack_store.py` — **new** `CockroachInstallationStore`
- `src/integrations/slack_app.py` — **new** Bolt app + event/action handlers
- `src/integrations/slack.py` — add `token` param to `send_slack_message`
- `src/api/routes/slack.py` — rewrite as Bolt passthrough
- `src/memory/organizations.py` — add `get_org_by_slack`, `store_slack_workflow`, etc.
- `src/agents/runners/slack_runner.py` — **new** pipeline orchestrator
- `src/agents/nodes/research.py` — wire Slack search tool
- `src/agents/nodes/publish.py` — token resolution via InstallationStore
- `src/agents/nodes/human.py` — fix `source_type` bug
- `.env.example` — add Slack OAuth env vars

### Frontend (TypeScript)
- `frontend/src/api/slack.ts` — **new** API client
- `frontend/src/api/types.ts` — add `SlackInstallation` interface
- `frontend/src/pages/Settings.tsx` — add Slack Integration section

### Tests
- `tests/test_slack_runner.py` — **new** runner tests
- `tests/integrations/test_slack_store.py` — **new** installation store tests
- `tests/api/test_slack_bolt_integration.py` — **new** Bolt integration tests

## Out of Scope

- Socket Mode (requires a persistent WebSocket connection, not suitable for serverless)
- Slack App Home / Tab views
- Slash commands (`/draftly ask ...`)
- Ambient channel monitoring (all messages, not just @mentions)
- Slack workflow builder integration
- Multi-workspace Slack Connect channel handling
- Slack Bookmarks / Canvas integration
