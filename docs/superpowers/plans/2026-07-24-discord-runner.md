# Implementation Plan: Discord Runner Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Discord runner pipeline so Discord messages trigger the full 8-node LangGraph documentation generation flow.

**Architecture:** Discord Gateway WebSocket receives messages, dispatches to an event handler that deduplicates and cleans text, then invokes `discord_runner.py` which builds state, compiles LangGraph with a CockroachDB checkpointer, and runs the pipeline. Publish node replies to the originating Discord thread.

**Tech Stack:** Python 3.11+, discord.py (Gateway WS), FastAPI, LangGraph, CockroachDB, httpx

---

### Task 1: Add `discord_guild_id` configuration

**Files:**
- Modify: `src/config.py:25-27`
- Modify: `.env`
- Modify: `.env.example`

- [ ] **Step 1: Add `discord_guild_id` to Settings**

In `src/config.py`, add after line 27 (`discord_public_key`):

```python
    discord_guild_id: str = ""
```

- [ ] **Step 2: Add `DISCORD_GUILD_ID` to `.env`**

Add after `DISCORD_PUBLIC_KEY`:

```
DISCORD_GUILD_ID=your-guild-id-here
```

- [ ] **Step 3: Add `DISCORD_GUILD_ID` to `.env.example`**

Add after `DISCORD_PUBLIC_KEY=your-public-key-here`:

```
# Discord server (guild) ID — used to look up the linked org
DISCORD_GUILD_ID=your-guild-id-here
```

- [ ] **Step 4: Commit**

```bash
git add src/config.py .env .env.example
git commit -m "feat: add discord_guild_id config"
```

---

### Task 2: Create `discord_workflows` database migration

**Files:**
- Create: `infrastructure/cockroachdb/migrations/011_add_discord_workflows.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: Add Discord workflow tracking table
-- Date: 2026-07-24

-- 16. Discord Workflows (pipeline runs triggered by Discord messages)
CREATE TABLE IF NOT EXISTS discord_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id STRING NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL,
    guild_id STRING NOT NULL,
    channel_id STRING NOT NULL,
    message_id STRING NOT NULL,
    author_id STRING,
    status STRING DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_discord_workflows_status ON discord_workflows(status);
CREATE INDEX IF NOT EXISTS idx_discord_workflows_guild ON discord_workflows(guild_id, channel_id);
```

- [ ] **Step 2: Run migration**

```bash
uv run python scripts/init_db.py
```

Expected: migration applies without errors.

- [ ] **Step 3: Commit**

```bash
git add infrastructure/cockroachdb/migrations/011_add_discord_workflows.sql
git commit -m "feat: add discord_workflows migration"
```

---

### Task 3: Add Discord DB functions to organizations module

**Files:**
- Modify: `src/memory/organizations.py`

- [ ] **Step 1: Add `get_org_by_discord`**

In `src/memory/organizations.py`, add after the `link_slack_installation` function (end of file):

```python
# --- Discord ---


async def get_org_by_discord(guild_id: str) -> dict | None:
    """Find organization by Discord guild_id."""
    row = await fetch_one(
        "SELECT clerk_org_id as id, clerk_org_name as name, discord_guild_id "
        "FROM organizations WHERE discord_guild_id = $1",
        guild_id,
    )
    return dict(row) if row else None
```

- [ ] **Step 2: Add `store_discord_workflow`**

Add after `get_org_by_discord`:

```python
async def store_discord_workflow(
    org_id: str,
    workflow_id: str,
    guild_id: str,
    channel_id: str,
    message_id: str,
    author_id: str,
) -> str:
    """Store a Discord workflow for tracking."""
    row = await fetch_one(
        """INSERT INTO discord_workflows
           (org_id, workflow_id, guild_id, channel_id, message_id, author_id)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text""",
        org_id,
        workflow_id,
        guild_id,
        channel_id,
        message_id,
        author_id,
    )
    logger.info(
        "discord_workflow_stored",
        org_id=org_id,
        workflow_id=workflow_id,
        guild_id=guild_id,
    )
    return row["id"]
```

- [ ] **Step 3: Add `update_discord_workflow_status`**

Add after `store_discord_workflow`:

```python
async def update_discord_workflow_status(workflow_id: str, status: str) -> None:
    """Update Discord workflow status."""
    from src.database import execute

    await execute(
        """UPDATE discord_workflows
           SET status = $1,
               completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN now()
                                    ELSE completed_at END
           WHERE workflow_id = $2""",
        status,
        workflow_id,
    )
```

- [ ] **Step 4: Commit**

```bash
git add src/memory/organizations.py
git commit -m "feat: add Discord DB functions (get_org_by_discord, store/update workflow)"
```

---

### Task 4: Create Discord runner

**Files:**
- Create: `src/agents/runners/discord_runner.py`

- [ ] **Step 1: Write the runner module**

```python
"""Discord pipeline runner — orchestrates the Draftly graph for Discord messages."""
from __future__ import annotations

import structlog
from langchain_cockroachdb import AsyncCockroachDBSaver

from src.agents.graph import build_hybrid_graph
from src.agents.state import DocumentationState
from src.config import settings

logger = structlog.get_logger()


def build_discord_state(
    guild_id: str,
    channel_id: str,
    message_id: str,
    author_id: str,
    text: str,
    org_id: str,
) -> DocumentationState:
    """Build initial DocumentationState from Discord message event."""
    graph_thread_id = f"discord-{channel_id}-{message_id}"

    return {
        "org_id": org_id,
        "source": "discord",
        "channel_id": channel_id,
        "thread_id": message_id,
        "graph_thread_id": graph_thread_id,
        "question": text,
        "similar_threads": [],
        "existing_docs": [],
        "reviewer_feedback_history": [],
        "semantic_context": [],
        "github_context": [],
        "slack_context": [],
        "knowledge_package": {},
        "draft_content": "",
        "draft_title": "",
        "doc_type": "howto",
        "confidence_score": 0.0,
        "review_result": {},
        "review_feedback": "",
        "human_decision": "",
        "human_feedback": "",
        "published_urls": [],
        "support_thread_id": "",
        "workflow_id": "",
        "doc_id": "",
        "messages": [],
        "source_metadata": {
            "guild_id": guild_id,
            "channel_id": channel_id,
            "message_id": message_id,
            "author_id": author_id,
        },
        "message_history": [],
    }


async def run_discord_pipeline(
    guild_id: str,
    channel_id: str,
    message_id: str,
    author_id: str,
    text: str,
) -> None:
    """Orchestrate the full Draftly pipeline for a Discord message."""
    from src.database import get_pool
    from src.integrations.discord import send_discord_message
    from src.memory.organizations import (
        get_org_by_discord,
        store_discord_workflow,
        update_discord_workflow_status,
    )

    await get_pool()

    try:
        logger.info(
            "discord_pipeline_started",
            guild_id=guild_id,
            channel_id=channel_id,
            message_id=message_id,
            text_preview=text[:100],
        )

        org = await get_org_by_discord(guild_id)
        if not org:
            logger.error("discord_pipeline_org_not_found", guild_id=guild_id)
            try:
                await send_discord_message(
                    channel_id,
                    "⚠️ Draftly is not linked to your server yet. "
                    "An admin needs to set `DISCORD_GUILD_ID` in the Draftly config.",
                )
            except Exception:
                logger.error("failed_to_post_org_not_found_message")
            return
        org_id = org["id"]

        state = build_discord_state(
            guild_id, channel_id, message_id, author_id, text, org_id
        )
        config = {"configurable": {"thread_id": state["graph_thread_id"]}}

        from uuid import uuid4

        workflow_id = str(uuid4())
        await store_discord_workflow(
            org_id=org_id,
            workflow_id=workflow_id,
            guild_id=guild_id,
            channel_id=channel_id,
            message_id=message_id,
            author_id=author_id,
        )
        await update_discord_workflow_status(workflow_id, "running")

        logger.info(
            "discord_pipeline_running",
            workflow_id=workflow_id,
            org_id=org_id,
            graph_thread_id=state["graph_thread_id"],
        )

        async with AsyncCockroachDBSaver.from_conn_string(
            settings.cockroachdb_url,
        ) as checkpointer:
            await checkpointer.setup()
            graph = build_hybrid_graph().compile(checkpointer=checkpointer)
            result = await graph.ainvoke(state, config)

        if result.get("human_decision") == "":
            await update_discord_workflow_status(workflow_id, "pending")
            logger.info(
                "discord_pipeline_paused",
                workflow_id=workflow_id,
                guild_id=guild_id,
                channel_id=channel_id,
                message_id=message_id,
            )
        else:
            await update_discord_workflow_status(workflow_id, "completed")
            logger.info(
                "discord_pipeline_completed",
                workflow_id=workflow_id,
                guild_id=guild_id,
                channel_id=channel_id,
            )

    except Exception as e:
        logger.error("discord_pipeline_failed", error=str(e))
        try:
            from src.integrations.discord import send_discord_message

            await send_discord_message(
                channel_id, f"Error processing request: {e}"
            )
        except Exception:
            logger.error("failed_to_post_discord_error")
```

- [ ] **Step 2: Verify module imports cleanly**

```bash
uv run python -c "from src.agents.runners.discord_runner import build_discord_state, run_discord_pipeline; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/agents/runners/discord_runner.py
git commit -m "feat: add discord_runner.py pipeline orchestrator"
```

---

### Task 5: Create Discord event handler

**Files:**
- Create: `src/integrations/discord_app.py`

- [ ] **Step 1: Write the event handler module**

```python
"""Discord event handler — processes messages and dispatches to the pipeline."""
from __future__ import annotations

import asyncio
import re

import structlog

logger = structlog.get_logger()

# Dedup guard: track recently processed message IDs to prevent duplicate runs
_processed_ids: set[str] = set()
_MAX_PROCESSED = 500


async def handle_message(
    guild_id: str,
    channel_id: str,
    message_id: str,
    author_id: str,
    content: str,
    bot_user_id: str,
) -> None:
    """Process a Discord message and dispatch to the pipeline.

    Called by the gateway client when a bot mention is received.
    """
    # Dedup
    if message_id in _processed_ids:
        return
    _processed_ids.add(message_id)
    if len(_processed_ids) > _MAX_PROCESSED:
        _processed_ids.clear()

    # Clean bot mention from text
    clean_text = re.sub(r"<@!?\d+>", "", content).strip()
    if not clean_text:
        return

    asyncio.create_task(
        _run_pipeline(guild_id, channel_id, message_id, author_id, clean_text)
    )
    logger.info(
        "discord_message_received",
        guild_id=guild_id,
        channel_id=channel_id,
        message_id=message_id,
    )


async def _run_pipeline(
    guild_id: str,
    channel_id: str,
    message_id: str,
    author_id: str,
    text: str,
) -> None:
    """Lazy import wrapper to avoid circular dependencies."""
    from src.agents.runners.discord_runner import run_discord_pipeline

    await run_discord_pipeline(
        guild_id=guild_id,
        channel_id=channel_id,
        message_id=message_id,
        author_id=author_id,
        text=text,
    )
```

- [ ] **Step 2: Verify module imports cleanly**

```bash
uv run python -c "from src.integrations.discord_app import handle_message; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/integrations/discord_app.py
git commit -m "feat: add discord_app.py event handler with dedup and pipeline dispatch"
```

---

### Task 6: Create Discord gateway client

**Files:**
- Create: `src/integrations/discord_gateway.py`

- [ ] **Step 1: Write the gateway client module**

```python
"""Discord Gateway client — maintains WebSocket connection to receive messages."""
from __future__ import annotations

import structlog

logger = structlog.get_logger()


def create_bot():
    """Create and configure the Discord bot client.

    Returns a discord.Client instance ready to be run.
    """
    import discord

    from src.config import settings
    from src.integrations.discord_app import handle_message

    intents = discord.Intents.default()
    intents.message_content = True

    bot = discord.Client(intents=intents)

    @bot.event
    async def on_ready():
        logger.info(
            "discord_bot_connected",
            user=str(bot.user),
            guilds=len(bot.guilds),
            guild_names=[g.name for g in bot.guilds],
        )

    @bot.event
    async def on_message(message):
        # Skip bot's own messages
        if message.author == bot.user:
            return

        # Only process messages that mention the bot
        if bot.user not in message.mentions:
            return

        # Skip DMs — only process guild messages
        if message.guild is None:
            return

        await handle_message(
            guild_id=str(message.guild.id),
            channel_id=str(message.channel.id),
            message_id=str(message.id),
            author_id=str(message.author.id),
            content=message.content,
            bot_user_id=str(bot.user.id),
        )

    return bot


def start_gateway() -> None:
    """Start the Discord gateway connection (blocking)."""
    from src.config import settings

    token = settings.discord_bot_token.get_secret_value()
    if not token:
        logger.error("discord_bot_token_missing")
        return

    bot = create_bot()
    logger.info("discord_gateway_starting")
    bot.run(token)


def start_gateway_background() -> None:
    """Start the Discord gateway in a background thread.

    Call this from the FastAPI lifespan to run the bot alongside the server.
    """
    import threading

    thread = threading.Thread(target=start_gateway, daemon=True, name="discord-gateway")
    thread.start()
    logger.info("discord_gateway_thread_started")
```

- [ ] **Step 2: Verify module imports cleanly**

```bash
uv run python -c "from src.integrations.discord_gateway import create_bot, start_gateway, start_gateway_background; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/integrations/discord_gateway.py
git commit -m "feat: add discord_gateway.py WebSocket client"
```

---

### Task 7: Start gateway in FastAPI lifespan

**Files:**
- Modify: `src/api/app.py`

- [ ] **Step 1: Add gateway startup to lifespan**

In `src/api/app.py`, modify the `lifespan` function to start the Discord gateway:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()

    # Start Discord gateway if configured
    from src.config import settings
    if settings.discord_bot_token.get_secret_value() and settings.discord_guild_id:
        from src.integrations.discord_gateway import start_gateway_background
        start_gateway_background()

    yield
    await close_pool()
```

- [ ] **Step 2: Verify server starts**

```bash
uv run uvicorn src.api.app:app --port 8000 &
sleep 3
curl -s http://localhost:8000/api/docs | head -5
kill %1 2>/dev/null
```

Expected: Server starts without errors, Swagger UI loads.

- [ ] **Step 3: Commit**

```bash
git add src/api/app.py
git commit -m "feat: start Discord gateway in FastAPI lifespan"
```

---

### Task 8: Add Discord API routes (invite-url, link, status)

**Files:**
- Modify: `src/api/routes/discord.py`
- Modify: `src/config.py`

- [ ] **Step 1: Add `discord_app_id` to Settings**

In `src/config.py`, add after `discord_guild_id`:

```python
    discord_app_id: str = ""
```

- [ ] **Step 2: Add `DISCORD_APP_ID` to `.env` and `.env.example`**

In `.env`, add:
```
DISCORD_APP_ID=your-app-id-here
```

In `.env.example`, add:
```
# Discord application ID (from Developer Portal > General Information)
DISCORD_APP_ID=your-app-id-here
```

- [ ] **Step 3: Add invite-url endpoint**

In `src/api/routes/discord.py`, add after the imports and before the `handle_interactions` endpoint:

```python
from pydantic import BaseModel

from src.api.auth import get_verified_token
from src.config import settings
from src.database import execute, fetch_one


class LinkDiscordRequest(BaseModel):
    guild_id: str


@router.get("/invite-url")
async def discord_invite_url():
    """Return the Discord bot invite URL with required permissions."""
    app_id = settings.discord_app_id
    if not app_id:
        raise HTTPException(status_code=500, detail="Discord app ID not configured")
    # Permissions: Send Messages (2048) + Send Messages in Threads (32768) = 34816
    invite_url = (
        f"https://discord.com/api/oauth2/authorize"
        f"?client_id={app_id}"
        f"&permissions=34816"
        f"&scope=bot"
    )
    return {"invite_url": invite_url}
```

- [ ] **Step 4: Add link endpoint**

Add after `discord_invite_url`:

```python
@router.post("/link")
async def link_discord(
    request: LinkDiscordRequest,
    token: dict = Depends(get_verified_token),
):
    """Link a Discord guild to the current Clerk organization."""
    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    await execute(
        "UPDATE organizations SET discord_guild_id = $1 WHERE clerk_org_id = $2",
        request.guild_id,
        org_id,
    )
    logger.info("discord_linked", org_id=org_id, guild_id=request.guild_id)
    return {"status": "linked", "guild_id": request.guild_id}
```

- [ ] **Step 5: Add status endpoint**

Add after `link_discord`:

```python
@router.get("/status")
async def discord_status(token: dict = Depends(get_verified_token)):
    """Return the Discord connection status for the current org."""
    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    row = await fetch_one(
        "SELECT discord_guild_id FROM organizations WHERE clerk_org_id = $1",
        org_id,
    )
    connected = bool(row and row["discord_guild_id"])
    return {
        "connected": connected,
        "guild_id": row["discord_guild_id"] if row else None,
    }
```

- [ ] **Step 6: Add HTTPException import if missing**

Ensure `HTTPException` is imported at the top of `src/api/routes/discord.py`:

```python
from fastapi import HTTPException, Request
```

- [ ] **Step 7: Commit**

```bash
git add src/api/routes/discord.py src/config.py .env .env.example
git commit -m "feat: add Discord invite-url, link, and status API routes"
```

---

### Task 9: Add frontend Discord API client and types

**Files:**
- Create: `frontend/src/api/discord.ts`
- Modify: `frontend/src/api/types.ts`

- [ ] **Step 1: Add Discord types to `types.ts`**

Add at the end of `frontend/src/api/types.ts`:

```typescript
export interface DiscordStatus {
  connected: boolean;
  guild_id: string | null;
}

export interface DiscordInviteUrl {
  invite_url: string;
}
```

- [ ] **Step 2: Create `frontend/src/api/discord.ts`**

```typescript
import { request } from "./client";
import type { DiscordInviteUrl, DiscordStatus } from "./types";

export async function getDiscordInviteUrl(): Promise<DiscordInviteUrl> {
  return request<DiscordInviteUrl>("/discord/invite-url");
}

export async function getDiscordStatus(): Promise<DiscordStatus> {
  return request<DiscordStatus>("/discord/status");
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

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/discord.ts frontend/src/api/types.ts
git commit -m "feat: add Discord API client and types"
```

---

### Task 10: Add Discord section to Settings page

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Add Discord imports**

In `frontend/src/pages/Settings.tsx`, add to the imports at the top:

```typescript
import { getDiscordInviteUrl, getDiscordStatus, linkDiscordGuild } from "../api/discord";
import type { DiscordInviteUrl, DiscordStatus } from "../api/types";
```

- [ ] **Step 2: Add Discord state variables**

In the `Settings` component, add after the Slack state variables (line 30):

```typescript
  const [discordInviteUrl, setDiscordInviteUrl] = useState<DiscordInviteUrl | null>(null);
  const [discordStatus, setDiscordStatus] = useState<DiscordStatus | null>(null);
  const [guildIdInput, setGuildIdInput] = useState("");
  const [discordLinking, setDiscordLinking] = useState(false);
```

- [ ] **Step 3: Add Discord to fetchData**

In the `fetchData` callback, add Discord calls to the `Promise.all`:

```typescript
      const results = await Promise.all([
        getInstallUrl(),
        listInstallations(),
        getSlackInstallUrl(),
        listSlackInstallations(),
        getDiscordInviteUrl(),
        getDiscordStatus(),
        ...(isAdmin ? [listOrgMembers()] : [Promise.resolve({ members: [] })]),
      ]);
      setInstallUrl(results[0]);
      setInstallations(results[1]);
      setSlackInstallUrl(results[2].install_url);
      setSlackInstallations(results[3]);
      setDiscordInviteUrl(results[4]);
      setDiscordStatus(results[5]);
      if (isAdmin && "members" in results[6]) {
        setMembers((results[6] as { members: OrgMember[] }).members);
      }
```

- [ ] **Step 4: Add `handleDiscordLink` function**

Add after the `handleRoleChange` function:

```typescript
  async function handleDiscordLink() {
    if (!guildIdInput.trim()) return;
    setDiscordLinking(true);
    setError(null);
    try {
      await linkDiscordGuild(guildIdInput.trim());
      setGuildIdInput("");
      fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to link Discord");
    } finally {
      setDiscordLinking(false);
    }
  }
```

- [ ] **Step 5: Add Discord section JSX**

Add after the Slack Integration section closing `</section>` (after line 318):

```tsx
      {/* Discord Integration section */}
      <section className="rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Discord Integration</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect Draftly to your Discord server to automatically generate documentation from support requests.
        </p>

        <div className="mt-4">
          {discordInviteUrl && (
            <a
              href={discordInviteUrl.invite_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
              </svg>
              Add to Discord Server
            </a>
          )}
        </div>

        {!discordStatus?.connected && (
          <div className="mt-4 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">
                Server (Guild) ID
              </label>
              <input
                type="text"
                value={guildIdInput}
                onChange={(e) => setGuildIdInput(e.target.value)}
                placeholder="e.g. 123456789012345678"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Right-click your server name in Discord → Copy Server ID
              </p>
            </div>
            <button
              onClick={handleDiscordLink}
              disabled={discordLinking || !guildIdInput.trim()}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {discordLinking ? "Connecting..." : "Connect"}
            </button>
          </div>
        )}

        {discordStatus?.connected && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">
                Guild: {discordStatus.guild_id}
              </span>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                Connected
              </span>
            </div>
          </div>
        )}
      </section>
```

- [ ] **Step 6: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat: add Discord Integration section to Settings page"
```

---

### Task 11: Write API route tests

**Files:**
- Create: `tests/api/test_discord_routes.py`

- [ ] **Step 1: Write the test file**

```python
"""Tests for Discord API routes (invite-url, link, status)."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.api.app import app


client = TestClient(app)


@pytest.fixture
def mock_token():
    """Mock verified token dependency."""
    with patch("src.api.auth.get_verified_token", return_value={"org_id": "org_123"}):
        yield


def test_invite_url_returns_url():
    """GET /api/discord/invite-url returns the bot invite URL."""
    with patch("src.config.settings") as mock_settings:
        mock_settings.discord_app_id = "1234567890"
        resp = client.get("/api/discord/invite-url")
    assert resp.status_code == 200
    data = resp.json()
    assert "invite_url" in data
    assert "client_id=1234567890" in data["invite_url"]
    assert "permissions=34816" in data["invite_url"]


def test_invite_url_missing_app_id():
    """GET /api/discord/invite-url returns 500 if app ID not configured."""
    with patch("src.config.settings") as mock_settings:
        mock_settings.discord_app_id = ""
        resp = client.get("/api/discord/invite-url")
    assert resp.status_code == 500


@pytest.mark.asyncio
async def test_link_sets_guild_id(mock_token):
    """POST /api/discord/link sets discord_guild_id on the org."""
    with patch("src.api.routes.discord.execute", new_callable=AsyncMock) as mock_exec:
        resp = client.post(
            "/api/discord/link",
            json={"guild_id": "9876543210"},
        )
    assert resp.status_code == 200
    assert resp.json()["guild_id"] == "9876543210"
    mock_exec.assert_called_once()


@pytest.mark.asyncio
async def test_status_returns_connected(mock_token):
    """GET /api/discord/status returns connected=true when guild_id is set."""
    with patch("src.api.routes.discord.fetch_one", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = {"discord_guild_id": "9876543210"}
        resp = client.get("/api/discord/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is True
    assert data["guild_id"] == "9876543210"


@pytest.mark.asyncio
async def test_status_returns_not_connected(mock_token):
    """GET /api/discord/status returns connected=false when no guild_id."""
    with patch("src.api.routes.discord.fetch_one", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = {"discord_guild_id": None}
        resp = client.get("/api/discord/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is False
    assert data["guild_id"] is None
```

- [ ] **Step 2: Run the tests**

```bash
uv run pytest tests/api/test_discord_routes.py -v
```

Expected: all 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/api/test_discord_routes.py
git commit -m "test: add Discord API route tests"
```

---

### Task 12: Write runner tests

**Files:**
- Create: `tests/test_discord_runner.py`

- [ ] **Step 1: Write the test file**

```python
"""Tests for the Discord pipeline runner."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from src.agents.runners.discord_runner import build_discord_state


def test_build_discord_state_basic():
    """State builder returns correct initial state."""
    state = build_discord_state(
        guild_id="123456789",
        channel_id="987654321",
        message_id="111222333",
        author_id="444555666",
        text="How do I configure SSO?",
        org_id="org_abc123",
    )

    assert state["org_id"] == "org_abc123"
    assert state["source"] == "discord"
    assert state["channel_id"] == "987654321"
    assert state["thread_id"] == "111222333"
    assert state["question"] == "How do I configure SSO?"
    assert state["graph_thread_id"] == "discord-987654321-111222333"


def test_build_discord_state_metadata():
    """State builder includes source_metadata with Discord identifiers."""
    state = build_discord_state(
        guild_id="123456789",
        channel_id="987654321",
        message_id="111222333",
        author_id="444555666",
        text="Test question",
        org_id="org_abc123",
    )

    metadata = state["source_metadata"]
    assert metadata["guild_id"] == "123456789"
    assert metadata["channel_id"] == "987654321"
    assert metadata["message_id"] == "111222333"
    assert metadata["author_id"] == "444555666"


def test_build_discord_state_defaults():
    """State builder initializes all required fields with defaults."""
    state = build_discord_state(
        guild_id="g1", channel_id="c1", message_id="m1",
        author_id="a1", text="q", org_id="o1",
    )

    assert state["similar_threads"] == []
    assert state["existing_docs"] == []
    assert state["draft_content"] == ""
    assert state["draft_title"] == ""
    assert state["confidence_score"] == 0.0
    assert state["human_decision"] == ""
    assert state["published_urls"] == []
    assert state["messages"] == []
    assert state["message_history"] == []


@pytest.mark.asyncio
async def test_run_discord_pipeline_org_not_found():
    """Pipeline sends error message when org is not linked."""
    with patch(
        "src.agents.runners.discord_runner.get_org_by_discord",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "src.agents.runners.discord_runner.send_discord_message",
        new_callable=AsyncMock,
    ) as mock_send, patch(
        "src.agents.runners.discord_runner.get_pool",
        new_callable=AsyncMock,
    ):
        from src.agents.runners.discord_runner import run_discord_pipeline

        await run_discord_pipeline(
            guild_id="unknown_guild",
            channel_id="ch1",
            message_id="msg1",
            author_id="user1",
            text="test",
        )

        mock_send.assert_called_once()
        args = mock_send.call_args
        assert "not linked" in args[0][1]
```

- [ ] **Step 2: Run the tests**

```bash
uv run pytest tests/test_discord_runner.py -v
```

Expected: all 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/test_discord_runner.py
git commit -m "test: add Discord runner unit tests"
```

---

### Task 13: Write event handler tests

**Files:**
- Create: `tests/integrations/test_discord_app.py`

- [ ] **Step 1: Write the test file**

```python
"""Tests for the Discord event handler."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from src.integrations.discord_app import handle_message, _processed_ids


@pytest.fixture(autouse=True)
def clear_dedup():
    """Clear dedup set between tests."""
    _processed_ids.clear()
    yield
    _processed_ids.clear()


@pytest.mark.asyncio
async def test_handle_message_dispatches_pipeline():
    """Message handler dispatches to pipeline with cleaned text."""
    with patch(
        "src.integrations.discord_app._run_pipeline",
        new_callable=AsyncMock,
    ) as mock_pipeline:
        await handle_message(
            guild_id="g1",
            channel_id="c1",
            message_id="m1",
            author_id="a1",
            content="<@123456> How do I configure SSO?",
            bot_user_id="123456",
        )

        import asyncio
        await asyncio.sleep(0.01)

        mock_pipeline.assert_called_once_with(
            "g1", "c1", "m1", "a1", "How do I configure SSO?"
        )


@pytest.mark.asyncio
async def test_handle_message_dedup():
    """Duplicate message IDs are ignored."""
    with patch(
        "src.integrations.discord_app._run_pipeline",
        new_callable=AsyncMock,
    ) as mock_pipeline:
        await handle_message(
            guild_id="g1", channel_id="c1", message_id="m1",
            author_id="a1", content="<@bot> test", bot_user_id="bot",
        )
        await handle_message(
            guild_id="g1", channel_id="c1", message_id="m1",
            author_id="a1", content="<@bot> test", bot_user_id="bot",
        )

        import asyncio
        await asyncio.sleep(0.01)

        mock_pipeline.assert_called_once()


@pytest.mark.asyncio
async def test_handle_message_skips_empty():
    """Messages that are only bot mentions are ignored."""
    with patch(
        "src.integrations.discord_app._run_pipeline",
        new_callable=AsyncMock,
    ) as mock_pipeline:
        await handle_message(
            guild_id="g1", channel_id="c1", message_id="m1",
            author_id="a1", content="<@123456>", bot_user_id="123456",
        )

        import asyncio
        await asyncio.sleep(0.01)

        mock_pipeline.assert_not_called()


@pytest.mark.asyncio
async def test_handle_message_strips_multiple_mentions():
    """Multiple bot mentions are all stripped."""
    with patch(
        "src.integrations.discord_app._run_pipeline",
        new_callable=AsyncMock,
    ) as mock_pipeline:
        await handle_message(
            guild_id="g1", channel_id="c1", message_id="m1",
            author_id="a1", content="<@123> <@456> Hello", bot_user_id="123",
        )

        import asyncio
        await asyncio.sleep(0.01)

        args = mock_pipeline.call_args[0]
        assert args[4] == "Hello"
```

- [ ] **Step 2: Run the tests**

```bash
uv run pytest tests/integrations/test_discord_app.py -v
```

Expected: all 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/integrations/test_discord_app.py
git commit -m "test: add Discord event handler unit tests"
```

---

### Task 14: Write gateway client tests

**Files:**
- Create: `tests/integrations/test_discord_gateway.py`

- [ ] **Step 1: Write the test file**

```python
"""Tests for the Discord gateway client."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


def test_create_bot_returns_client():
    """create_bot returns a configured discord.Client."""
    with patch("discord.Client") as MockClient:
        mock_instance = MagicMock()
        MockClient.return_value = mock_instance

        from src.integrations.discord_gateway import create_bot

        with patch("src.config.settings") as mock_settings:
            mock_settings.discord_bot_token.get_secret_value.return_value = "test-token"
            bot = create_bot()

        assert bot is mock_instance


def test_start_gateway_calls_bot_run():
    """start_gateway calls bot.run with the configured token."""
    with patch("src.integrations.discord_gateway.create_bot") as mock_create:
        mock_bot = MagicMock()
        mock_create.return_value = mock_bot

        from src.integrations.discord_gateway import start_gateway

        with patch("src.config.settings") as mock_settings:
            mock_settings.discord_bot_token.get_secret_value.return_value = "test-token"
            start_gateway()

        mock_bot.run.assert_called_once_with("test-token")


def test_start_gateway_skips_without_token():
    """start_gateway does nothing if token is empty."""
    with patch("src.integrations.discord_gateway.create_bot") as mock_create:
        from src.integrations.discord_gateway import start_gateway

        with patch("src.config.settings") as mock_settings:
            mock_settings.discord_bot_token.get_secret_value.return_value = ""
            start_gateway()

        mock_create.assert_not_called()


def test_start_gateway_background_spawns_thread():
    """start_gateway_background starts a daemon thread."""
    with patch("threading.Thread") as MockThread:
        mock_thread = MagicMock()
        MockThread.return_value = mock_thread

        from src.integrations.discord_gateway import start_gateway_background

        start_gateway_background()

        MockThread.assert_called_once()
        mock_thread.start.assert_called_once()
        assert mock_thread.daemon is True
```

- [ ] **Step 2: Run the tests**

```bash
uv run pytest tests/integrations/test_discord_gateway.py -v
```

Expected: all 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/integrations/test_discord_gateway.py
git commit -m "test: add Discord gateway client unit tests"
```

---

### Task 15: Run full verification

**Files:** None (verification only)

- [ ] **Step 1: Lint**

```bash
uv run ruff check src/
```

Expected: no errors.

- [ ] **Step 2: Type check**

```bash
uv run mypy src/
```

Expected: no new errors.

- [ ] **Step 3: All tests**

```bash
uv run pytest -v
```

Expected: all tests pass (existing + new).

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address lint/type issues from Discord runner"
```

---

## Execution Order

```
Task 1  (config)              ← no dependencies
Task 2  (migration)           ← no dependencies, parallel with Task 1
Task 3  (DB functions)        ← depends on Task 2 (migration must exist)
Task 4  (runner)              ← depends on Task 3 (uses DB functions)
Task 5  (event handler)       ← depends on Task 4 (imports runner)
Task 6  (gateway client)      ← depends on Task 5 (imports event handler)
Task 7  (FastAPI lifespan)    ← depends on Task 6 (imports gateway)
Task 8  (API routes)          ← depends on Task 1 (config), parallel with 4-7
Task 9  (frontend API/types)  ← depends on Task 8 (backend routes exist)
Task 10 (Settings.tsx)        ← depends on Task 9 (frontend API client)
Task 11 (API route tests)     ← depends on Task 8
Task 12 (runner tests)        ← depends on Task 4
Task 13 (handler tests)       ← depends on Task 5
Task 14 (gateway tests)       ← depends on Task 6
Task 15 (verification)        ← depends on all above
```

Tasks 1-2 can run in parallel. Tasks 4-8 can run in parallel after Task 3. Tasks 11-14 can run in parallel after their respective implementation tasks.
