# Design Spec: Discord Runner Pipeline

**Date:** 2026-07-24
**Status:** Draft
**Author:** opencode

## Summary

Add a Discord runner pipeline so Discord messages can trigger the full 8-node LangGraph documentation generation flow, making Discord a first-class source alongside Slack and GitHub. Currently Discord only participates as a notification channel (review cards + button clicks) — this change adds the upstream trigger and orchestration layer.

## Motivation

Slack has `slack_runner.py` + Bolt event handlers. GitHub has `github_runner.py` + webhook receiver. Discord has notification/review handling but no way to receive messages and trigger the pipeline. This means Discord users can't start the documentation workflow from Discord — they must use the CLI or another source. Adding a Discord runner closes this gap.

## Scope

**In scope:**
- `discord_workflows` table for pipeline run tracking
- `discord_runner.py` orchestrator mirroring `slack_runner.py` / `github_runner.py`
- Discord Gateway WebSocket client (`discord_gateway.py`) for receiving messages
- Event handler (`discord_app.py`) with dedup guard and pipeline dispatch
- `get_org_by_discord()` org resolution via `organizations.discord_guild_id`
- DB functions: `store_discord_workflow()`, `update_discord_workflow_status()`
- Config: `discord_guild_id` setting
- Backend API routes: `GET /api/discord/invite-url`, `POST /api/discord/link`, `GET /api/discord/status`
- Frontend Settings page Discord section (invite link + guild ID input)
- Frontend API client (`frontend/src/api/discord.ts`) and types
- Tests for runner, gateway client, event handler, and API routes

**Out of scope:**
- Discord OAuth (bot token is static, no OAuth needed — different from Slack/GitHub)
- Slash commands (`/draftly ask ...`)
- Discord App Home / Tabs
- Multi-guild support (one guild per deployment)
- Discord slash command registration

## Architecture

### Current State

```
Slack:   Bolt Events → slack_runner.py → 8-node pipeline → publish → reply to thread
GitHub:  Webhook → github_runner.py → 8-node pipeline → publish → reply to issue
Discord: (no trigger) → ... → publish → _reply_to_discord() (exists but unreachable from Discord)
```

### Target State

```
Discord: Gateway WS → discord_app.py → discord_runner.py → 8-node pipeline → publish → reply to thread
```

### Data Flow

```
User mentions bot in Discord channel
         │
         ▼
┌─────────────────────────────────────────┐
│  Discord Gateway Client                 │
│  src/integrations/discord_gateway.py    │
│                                         │
│  1. Connect to Discord gateway WS       │
│  2. Receive MESSAGE_CREATE events       │
│  3. Filter: bot mentions only           │
│  4. Pass to event handler               │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Discord Event Handler                  │
│  src/integrations/discord_app.py        │
│                                         │
│  1. Dedup guard (recent message IDs)    │
│  2. Clean bot mention from text         │
│  3. asyncio.create_task(pipeline)       │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Discord Runner                         │
│  src/agents/runners/discord_runner.py   │
│                                         │
│  1. get_org_by_discord(guild_id)        │
│  2. build_discord_state()               │
│  3. Compile LangGraph + checkpointer    │
│  4. Store discord_workflows record      │
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
│  _reply_to_discord() posts generated    │
│  documentation as thread reply          │
└─────────────────────────────────────────┘
```

## Components

### 1. Database Migration

**New file:** `infrastructure/cockroachdb/migrations/011_add_discord_workflows.sql`

**`discord_workflows` table** — Pipeline run tracking (mirrors `slack_workflows`):

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `org_id` | STRING FK | References `organizations(clerk_org_id)` |
| `workflow_id` | UUID | Pipeline run ID |
| `guild_id` | STRING | Discord guild (server) ID |
| `channel_id` | STRING | Channel where message was posted |
| `message_id` | STRING | Discord message ID |
| `author_id` | STRING | User who sent the message |
| `status` | STRING | pending/running/completed/failed |
| `created_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | |

### 2. Configuration

**File:** `src/config.py`

Add one setting:

```python
discord_guild_id: str = ""
```

Existing `discord_bot_token` and `discord_public_key` remain.

### 3. DB Layer Functions

**File:** `src/memory/organizations.py`

```python
async def get_org_by_discord(guild_id: str) -> dict | None:
    """Find org by Discord guild_id via organizations.discord_guild_id."""

async def store_discord_workflow(
    org_id: str, workflow_id: str, guild_id: str,
    channel_id: str, message_id: str, author_id: str,
) -> str:

async def update_discord_workflow_status(workflow_id: str, status: str) -> None:
```

### 4. Discord Runner (`src/agents/runners/discord_runner.py`)

Mirrors `slack_runner.py`. Builds `DocumentationState` from Discord message event, compiles LangGraph with CockroachDB checkpointer, invokes the 8-node pipeline.

**State builder:**
```python
def build_discord_state(
    guild_id: str, channel_id: str, message_id: str,
    author_id: str, text: str, org_id: str,
) -> DocumentationState:
    graph_thread_id = f"discord-{channel_id}-{message_id}"
    return {
        "org_id": org_id,
        "source": "discord",
        "channel_id": channel_id,
        "thread_id": message_id,
        "graph_thread_id": graph_thread_id,
        "question": text,
        "source_metadata": {
            "guild_id": guild_id,
            "channel_id": channel_id,
            "message_id": message_id,
            "author_id": author_id,
        },
        # ... all default fields initialized ...
    }
```

**Pipeline orchestrator:**
1. `get_org_by_discord(guild_id)` — Look up org
2. `build_discord_state()` — Build initial state
3. Compile graph with checkpointer
4. `store_discord_workflow()` — Track run
5. `graph.ainvoke()` — Run pipeline
6. Update workflow status
7. On error: send error reply to Discord channel

### 5. Discord Gateway Client (`src/integrations/discord_gateway.py`)

Uses `discord.py` library (already in `pyproject.toml`) to maintain a persistent WebSocket connection to Discord's gateway. Receives MESSAGE_CREATE events and dispatches to the event handler.

```python
import discord

class DraftlyBot(discord.Client):
    async def on_ready(self):
        logger.info("discord_bot_connected", guilds=len(self.guilds))

    async def on_message(self, message):
        # Skip bot's own messages
        if message.author == self.user:
            return
        # Only process mentions
        if self.user not in message.mentions:
            return
        # Dispatch to event handler
        await handle_message(message)

def start_gateway():
    intents = discord.Intents.default()
    intents.message_content = True
    bot = DraftlyBot(intents=intents)
    bot.run(settings.discord_bot_token.get_secret_value())
```

### 6. Event Handler (`src/integrations/discord_app.py`)

Parallels `slack_app.py`. Handles dedup, text cleaning, and pipeline dispatch.

```python
_processed_ids: set[str] = set()
_MAX_PROCESSED = 500

async def handle_message(message):
    if message.id in _processed_ids:
        return
    _processed_ids.add(message.id)
    if len(_processed_ids) > _MAX_PROCESSED:
        _processed_ids.clear()

    # Clean bot mention from text
    clean_text = re.sub(r"<@!?\d+>", "", message.content).strip()
    if not clean_text:
        return

    asyncio.create_task(
        run_discord_pipeline(
            guild_id=str(message.guild.id),
            channel_id=str(message.channel.id),
            message_id=str(message.id),
            author_id=str(message.author.id),
            text=clean_text,
        )
    )
```

### 7. Backend API Routes (`src/api/routes/discord.py`)

Add three endpoints to the existing Discord router (which already handles `/interactions`):

**`GET /api/discord/invite-url`** — Returns the bot invite URL for the configured client ID:

```python
@router.get("/invite-url")
async def discord_invite_url():
    # Build invite URL with required permissions
    # Permissions: Send Messages (2048) + Send Messages in Threads (32768) = 34816
    return {
        "invite_url": f"https://discord.com/api/oauth2/authorize"
                      f"?client_id={settings.discord_app_id}"
                      f"&permissions=34816"
                      f"&scope=bot"
    }
```

**`POST /api/discord/link`** — Links a Discord guild to the current Clerk organization:

```python
class LinkDiscordRequest(BaseModel):
    guild_id: str

@router.post("/link")
async def link_discord(request: LinkDiscordRequest, token: dict = Depends(get_verified_token)):
    org_id = token.get("org_id")
    await execute(
        "UPDATE organizations SET discord_guild_id = $1 WHERE clerk_org_id = $2",
        request.guild_id, org_id,
    )
    return {"status": "linked", "guild_id": request.guild_id}
```

**`GET /api/discord/status`** — Returns the current Discord connection status for the org:

```python
@router.get("/status")
async def discord_status(token: dict = Depends(get_verified_token)):
    org_id = token.get("org_id")
    row = await fetch_one(
        "SELECT discord_guild_id FROM organizations WHERE clerk_org_id = $1",
        org_id,
    )
    return {
        "connected": bool(row and row["discord_guild_id"]),
        "guild_id": row["discord_guild_id"] if row else None,
    }
```

### 8. Frontend API Client (`frontend/src/api/discord.ts`)

New file mirroring `slack.ts` and `github.ts`:

```typescript
import { request } from "./client";

export async function getDiscordInviteUrl(): Promise<{ invite_url: string }> {
  return request("/discord/invite-url");
}

export async function getDiscordStatus(): Promise<{ connected: boolean; guild_id: string | null }> {
  return request("/discord/status");
}

export async function linkDiscordGuild(
  guildId: string,
): Promise<{ status: string; guild_id: string }> {
  return request("/discord/link", {
    method: "POST",
    body: JSON.stringify({ guild_id: guildId }),
  });
}
```

### 9. Frontend Types (`frontend/src/api/types.ts`)

Add Discord-related types:

```typescript
export interface DiscordStatus {
  connected: boolean;
  guild_id: string | null;
}

export interface DiscordInviteUrl {
  invite_url: string;
}
```

### 10. Settings Page Discord Section (`frontend/src/pages/Settings.tsx`)

Add a "Discord Integration" section after the Slack section. Unlike GitHub/Slack which use OAuth redirects, Discord uses a **hybrid flow**: static invite link + manual guild ID input.

**Why different from GitHub/Slack:**
- GitHub: OAuth redirect → callback with `?installation_id=...` → auto-link
- Slack: OAuth redirect → callback with `?team_id=...` → auto-link
- Discord: Static invite URL → user adds bot to server → copies guild ID → pastes into input → manual link

**Section structure:**
1. "Add to Discord" button → opens Discord bot invite URL in new tab
2. Guild ID input field + "Connect" button → calls `linkDiscordGuild(guildId)`
3. Status display: shows connected server name if `discord_guild_id` is set
4. Helper text explaining how to find the guild ID (Discord > Server Settings > copy ID)

```tsx
{/* Discord Integration section */}
<section className="rounded-lg border border-gray-200 p-6">
  <h2 className="text-lg font-semibold text-gray-900">Discord Integration</h2>
  <p className="mt-1 text-sm text-gray-500">
    Connect Draftly to your Discord server to automatically generate documentation from support requests.
  </p>

  <div className="mt-4">
    <a href={discordInviteUrl?.invite_url ?? "#"}
       target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
      {/* Discord SVG icon */}
      Add to Discord Server
    </a>
  </div>

  {/* Guild ID input (shown if not yet connected) */}
  {!discordStatus?.connected && (
    <div className="mt-4 flex items-end gap-2">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700">Server (Guild) ID</label>
        <input type="text" value={guildIdInput} onChange={...}
               placeholder="e.g. 123456789012345678"
               className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 ..." />
        <p className="mt-1 text-xs text-gray-400">
          Right-click your server name in Discord → Copy Server ID
        </p>
      </div>
      <button onClick={handleDiscordLink}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        Connect
      </button>
    </div>
  )}

  {/* Connected status */}
  {discordStatus?.connected && (
    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900">Guild: {discordStatus.guild_id}</span>
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
          Connected
        </span>
      </div>
    </div>
  )}
</section>
```

### 11. Socket Mode Equivalent (Local Dev)

Discord Gateway is the only way to receive messages — there's no HTTP webhook mode for bot messages. The gateway client runs as a background task alongside the FastAPI server. For local dev, start the bot separately or in a thread:

```python
# In src/api/app.py lifespan or a separate script
import asyncio
from src.integrations.discord_gateway import start_gateway

# Start gateway in background thread
thread = threading.Thread(target=start_gateway, daemon=True)
thread.start()
```

## Error Handling

| Error | Handling |
|---|---|
| Unknown guild_id (no org linked) | Log warning, send help message to channel |
| Bot not mentioned in channel message | Ignore event |
| Pipeline failure | Send error reply to Discord channel |
| Gateway disconnect | discord.py auto-reconnects (built-in) |
| Token invalid | Log error, bot stops |
| Rate limit | discord.py handles automatically |

## Testing Strategy

- **Unit tests:** `discord_runner.py` (state builder), `discord_app.py` (dedup, text cleaning)
- **Mock tests:** `run_discord_pipeline` invocation from event handler
- **Integration tests:** Gateway client connection lifecycle

## Files Changed

### Backend (Python)
- `infrastructure/cockroachdb/migrations/011_add_discord_workflows.sql` — **new** migration
- `src/config.py` — add `discord_guild_id`, `discord_app_id`
- `src/integrations/discord_app.py` — **new** event handler
- `src/integrations/discord_gateway.py` — **new** gateway client
- `src/agents/runners/discord_runner.py` — **new** pipeline orchestrator
- `src/api/routes/discord.py` — add `/invite-url`, `/link`, `/status` endpoints
- `src/memory/organizations.py` — add `get_org_by_discord`, `store_discord_workflow`, etc.

### Frontend (TypeScript)
- `frontend/src/api/discord.ts` — **new** API client
- `frontend/src/api/types.ts` — add `DiscordStatus`, `DiscordInviteUrl` interfaces
- `frontend/src/pages/Settings.tsx` — add Discord Integration section

### Tests
- `tests/test_discord_runner.py` — **new** runner tests
- `tests/integrations/test_discord_gateway.py` — **new** gateway tests
- `tests/integrations/test_discord_app.py` — **new** event handler tests
- `tests/api/test_discord_routes.py` — **new** API route tests
