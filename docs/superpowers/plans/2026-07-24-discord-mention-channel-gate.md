# Implementation Plan: Discord @mention + Channel-Gated Trigger

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bot only triggers when (1) explicitly @mentioned AND (2) message is in a configured trigger channel. No channels configured = no triggers.

**Architecture:** Event handler checks bot mention in `mentioned_users` and channel ID against per-org trigger list stored in `organizations.discord_trigger_channels` (JSONB). Settings page lets users select channels from a dropdown populated via Discord API.

**Tech Stack:** Python 3.11+, FastAPI, CockroachDB, httpx, React 19, TailwindCSS

---

### Task 1: Add `discord_trigger_channels` column + migration

**Files:**
- Modify: `infrastructure/cockroachdb/schema.sql`
- Create: `infrastructure/cockroachdb/migrations/012_add_discord_trigger_channels.sql`

- [ ] **Step 1: Add column to schema.sql**

In `infrastructure/cockroachdb/schema.sql`, add after `discord_guild_id STRING` (line ~13):

```sql
    discord_trigger_channels JSONB DEFAULT '[]'::JSONB,
```

- [ ] **Step 2: Create migration file**

Create `infrastructure/cockroachdb/migrations/012_add_discord_trigger_channels.sql`:

```sql
-- Migration 012: Add discord_trigger_channels to organizations
-- Stores array of channel IDs where the bot should respond to @mentions

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS discord_trigger_channels JSONB DEFAULT '[]'::jsonb;
```

- [ ] **Step 3: Commit**

```bash
git add infrastructure/cockroachdb/schema.sql infrastructure/cockroachdb/migrations/012_add_discord_trigger_channels.sql
git commit -m "feat(db): add discord_trigger_channels column to organizations"
```

---

### Task 2: Add trigger channels API endpoints

**Files:**
- Modify: `src/api/routes/discord.py`

- [ ] **Step 1: Add Pydantic model for trigger channels**

In `src/api/routes/discord.py`, add after `LinkDiscordRequest`:

```python
class TriggerChannelsRequest(BaseModel):
    channels: list[str]
```

- [ ] **Step 2: Add GET /discord/channels endpoint (fetch from Discord API)**

This endpoint fetches available text channels from the linked Discord guild.

```python
@router.get("/channels")
async def discord_channels(token: dict = Depends(get_verified_token)):
    """Fetch available text channels from the linked Discord guild."""
    import httpx

    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    row = await fetch_one(
        "SELECT discord_guild_id FROM organizations WHERE clerk_org_id = $1",
        org_id,
    )
    if not row or not row["discord_guild_id"]:
        raise HTTPException(status_code=400, detail="Discord not linked")

    guild_id = row["discord_guild_id"]
    bot_token = settings.discord_bot_token.get_secret_value()

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://discord.com/api/v10/guilds/{guild_id}/channels",
            headers={"Authorization": f"Bot {bot_token}"},
            timeout=10,
        )
        if resp.status_code != 200:
            logger.error("discord_channels_fetch_failed", status=resp.status_code)
            raise HTTPException(status_code=502, detail="Failed to fetch Discord channels")
        channels = resp.json()

    # Filter to text channels only (type 0 = text, type 5 = announcement, type 15 = forum)
    TEXT_CHANNEL_TYPES = {0, 5, 15}
    result = [
        {"id": ch["id"], "name": ch["name"], "type": ch["type"]}
        for ch in channels
        if ch.get("type") in TEXT_CHANNEL_TYPES
    ]
    return {"channels": result}
```

- [ ] **Step 3: Add GET /discord/trigger-channels endpoint**

```python
@router.get("/trigger-channels")
async def get_trigger_channels(token: dict = Depends(get_verified_token)):
    """Return the configured trigger channels for the current org."""
    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    row = await fetch_one(
        "SELECT discord_trigger_channels FROM organizations WHERE clerk_org_id = $1",
        org_id,
    )
    channels = row["discord_trigger_channels"] if row else []
    return {"channels": channels}
```

- [ ] **Step 4: Add POST /discord/trigger-channels endpoint**

```python
@router.post("/trigger-channels")
async def set_trigger_channels(
    request: TriggerChannelsRequest,
    token: dict = Depends(get_verified_token),
):
    """Set the trigger channels for the current org."""
    import json

    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    await execute(
        "UPDATE organizations SET discord_trigger_channels = $1 WHERE clerk_org_id = $2",
        json.dumps(request.channels),
        org_id,
    )
    logger.info("discord_trigger_channels_updated", org_id=org_id, channels=request.channels)
    return {"channels": request.channels}
```

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/discord.py
git commit -m "feat(api): add Discord trigger channels and channel list endpoints"
```

---

### Task 3: Update invite URL permissions

**Files:**
- Modify: `src/api/routes/discord.py`

- [ ] **Step 1: Update permissions in invite URL**

In `discord_invite_url()`, change permissions from `34816` to `34820`:

```python
    # Permissions: Send Messages (2048) + Send Messages in Threads (32768) + View Channels (4) = 34820
    invite_url = (
        f"https://discord.com/api/oauth2/authorize"
        f"?client_id={app_id}"
        f"&permissions=34820"
        f"&scope=bot"
    )
```

- [ ] **Step 2: Commit**

```bash
git add src/api/routes/discord.py
git commit -m "fix(discord): add View Channels permission to bot invite URL"
```

---

### Task 4: Add frontend API client + types

**Files:**
- Modify: `frontend/src/api/discord.ts`
- Modify: `frontend/src/api/types.ts`

- [ ] **Step 1: Add Discord channel types to types.ts**

In `frontend/src/api/types.ts`, add after `DiscordInviteUrl`:

```typescript
export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

export interface DiscordTriggerChannels {
  channels: string[];
}
```

- [ ] **Step 2: Add API functions to discord.ts**

In `frontend/src/api/discord.ts`, add:

```typescript
import type {
  DiscordChannel,
  DiscordInviteUrl,
  DiscordStatus,
  DiscordTriggerChannels,
} from "./types";

// ... existing functions ...

export async function getDiscordChannels(): Promise<{ channels: DiscordChannel[] }> {
  return request("/discord/channels");
}

export async function getTriggerChannels(): Promise<DiscordTriggerChannels> {
  return request<DiscordTriggerChannels>("/discord/trigger-channels");
}

export async function setTriggerChannels(
  channels: string[],
): Promise<DiscordTriggerChannels> {
  return request("/discord/trigger-channels", {
    method: "POST",
    body: JSON.stringify({ channels }),
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/discord.ts frontend/src/api/types.ts
git commit -m "feat(frontend): add Discord trigger channels API client and types"
```

---

### Task 5: Add trigger channels UI to Settings page

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Add imports**

In `frontend/src/pages/Settings.tsx`, update Discord imports:

```typescript
import {
  getDiscordInviteUrl,
  getDiscordStatus,
  linkDiscordGuild,
  getDiscordChannels,
  getTriggerChannels,
  setTriggerChannels,
} from "../api/discord";
import type {
  DiscordChannel,
  DiscordInviteUrl,
  DiscordStatus,
  DiscordTriggerChannels,
  // ... existing types
} from "../api/types";
```

- [ ] **Step 2: Add state variables**

Add after the Discord state variables:

```typescript
  const [availableChannels, setAvailableChannels] = useState<DiscordChannel[]>([]);
  const [triggerChannelIds, setTriggerChannelIds] = useState<string[]>([]);
  const [triggerSaving, setTriggerSaving] = useState(false);
```

- [ ] **Step 3: Fetch channels when connected**

In `fetchData`, after Discord status check, add:

```typescript
      if (discordStatusResult.connected) {
        const channelsResult = await getDiscordChannels();
        setAvailableChannels(channelsResult.channels);
        const triggerResult = await getTriggerChannels();
        setTriggerChannelIds(triggerResult.channels);
      }
```

- [ ] **Step 4: Add handleToggleChannel function**

```typescript
  async function handleToggleChannel(channelId: string) {
    setTriggerSaving(true);
    setError(null);
    try {
      const newIds = triggerChannelIds.includes(channelId)
        ? triggerChannelIds.filter((id) => id !== channelId)
        : [...triggerChannelIds, channelId];
      await setTriggerChannels(newIds);
      setTriggerChannelIds(newIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update trigger channels");
    } finally {
      setTriggerSaving(false);
    }
  }
```

- [ ] **Step 5: Add Trigger Channels section JSX**

Add after the Discord connected status card:

```tsx
        {/* Trigger Channels section — only shown when connected */}
        {discordStatus?.connected && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-700">Trigger Channels</h3>
            <p className="mt-1 text-xs text-gray-500">
              Bot will only respond when @mentioned in these channels.
            </p>

            {availableChannels.length > 0 ? (
              <div className="mt-3 space-y-1">
                {availableChannels.map((ch) => (
                  <label
                    key={ch.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={triggerChannelIds.includes(ch.id)}
                      onChange={() => handleToggleChannel(ch.id)}
                      disabled={triggerSaving}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">#{ch.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-gray-400">
                No text channels available. Ensure the bot has permission to view channels.
              </p>
            )}

            {triggerChannelIds.length === 0 && (
              <p className="mt-2 text-xs text-amber-600">
                No trigger channels selected — bot won't respond to any messages.
              </p>
            )}
          </div>
        )}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat(frontend): add Discord trigger channels multi-select to Settings"
```

---

### Task 6: Store bot user ID from Gateway READY event

**Files:**
- Modify: `src/integrations/discord_gateway.py`

- [ ] **Step 1: Add bot_user_id to DiscordGateway class**

In `src/integrations/discord_gateway.py`, add to `__init__`:

```python
        self._bot_user_id: str | None = None
```

- [ ] **Step 2: Store bot_user_id on READY event**

In `_handle_dispatch`, update the READY handler:

```python
        if event == "READY":
            self._session_id = data.get("session_id")
            self._bot_user_id = data.get("user", {}).get("id")
            logger.info("discord_gateway_ready", session_id=self._session_id, bot_user_id=self._bot_user_id)
            return
```

- [ ] **Step 3: Add bot_user_id property**

Add after `__init__`:

```python
    @property
    def bot_user_id(self) -> str | None:
        return self._bot_user_id
```

- [ ] **Step 4: Commit**

```bash
git add src/integrations/discord_gateway.py
git commit -m "feat(gateway): store bot_user_id from READY event"
```

---

### Task 7: Update event handler with @mention + channel checks

**Files:**
- Modify: `src/integrations/discord_app.py`
- Modify: `src/memory/organizations.py`

- [ ] **Step 1: Extend get_org_by_discord to return trigger channels**

In `src/memory/organizations.py`, update `get_org_by_discord`:

```python
async def get_org_by_discord(guild_id: str) -> dict | None:
    """Find organization by Discord guild_id."""
    row = await fetch_one(
        """SELECT clerk_org_id as id, clerk_org_name as name,
                  discord_guild_id, discord_trigger_channels
           FROM organizations WHERE discord_guild_id = $1""",
        guild_id,
    )
    return dict(row) if row else None
```

- [ ] **Step 2: Add bot mention check to handle_message_create**

In `src/integrations/discord_app.py`, update `handle_message_create` to check bot mention:

```python
async def handle_message_create(data: dict) -> None:
    """Handle MESSAGE_CREATE events from the Discord Gateway."""
    guild_id = data.get("guild_id", "")
    channel_id = data.get("channel_id", "")
    message_id = data.get("id", "")
    thread_id = data.get("thread", {}).get("id") if "thread" in data else None
    author = data.get("author", {})
    user_id = author.get("id", "")
    author_bot = author.get("bot", False)
    text = data.get("content", "")

    # Ignore bot messages
    if _is_bot_message(user_id, author_bot):
        return

    # Ignore empty messages
    if not text.strip():
        return

    # Ignore messages without guild_id (DMs)
    if not guild_id:
        return

    # Dedup guard
    if message_id in _processed_ids:
        return
    _processed_ids.add(message_id)
    if len(_processed_ids) > _MAX_PROCESSED:
        _processed_ids.clear()

    # --- Check 1: Is bot mentioned? ---
    from src.integrations.discord_gateway import gateway as discord_gateway

    bot_id = discord_gateway.bot_user_id
    if not bot_id:
        logger.warning("discord_bot_user_id_not_set")
        return

    mentions = data.get("mentions", [])
    mentioned_ids = [m.get("id") for m in mentions]
    if bot_id not in mentioned_ids:
        return  # Not mentioning the bot — ignore

    # --- Check 2: Is channel in trigger list? ---
    from src.memory.organizations import get_org_by_discord

    org = await get_org_by_discord(guild_id)
    if not org:
        return  # Guild not linked — ignore

    trigger_channels = org.get("discord_trigger_channels") or []
    if channel_id not in trigger_channels:
        return  # Channel not in trigger list — ignore

    # Clean text
    clean_text = _clean_discord_text(text)
    if not clean_text:
        return

    # React with eyes emoji to acknowledge
    try:
        token = settings.discord_bot_token.get_secret_value()
        headers = {"Authorization": f"Bot {token}", "Content-Type": "application/json"}
        async with httpx.AsyncClient() as client:
            await client.put(
                f"https://discord.com/api/v10/channels/{channel_id}/messages/{message_id}/reactions/@me/👀",
                headers=headers,
                timeout=10,
            )
    except Exception:
        logger.warning("discord_reaction_failed", message_id=message_id)

    logger.info(
        "discord_message_received",
        guild_id=guild_id,
        channel_id=channel_id,
        message_id=message_id,
    )

    asyncio.create_task(
        _run_pipeline(guild_id, channel_id, message_id, thread_id, clean_text, user_id)
    )
```

- [ ] **Step 3: Commit**

```bash
git add src/integrations/discord_app.py src/memory/organizations.py
git commit -m "feat(discord): gate pipeline on @mention + trigger channel"
```

---

### Task 8: Write tests

**Files:**
- Modify: `tests/integrations/test_discord_app.py`
- Modify: `tests/api/test_discord_routes.py`

- [ ] **Step 1: Update discord_app tests for mention + channel gating**

Update `tests/integrations/test_discord_app.py`:

```python
@pytest.mark.asyncio
async def test_handle_message_create_ignores_no_mention() -> None:
    """handle_message_create ignores messages that don't mention the bot."""
    from src.integrations.discord_app import handle_message_create, _processed_ids

    _processed_ids.clear()
    data = {
        "guild_id": "g1",
        "channel_id": "ch1",
        "id": "no_mention_123",
        "author": {"id": "user1", "bot": False},
        "content": "Hello everyone",
        "mentions": [],  # No bot mention
    }

    with (
        patch("src.integrations.discord_app.discord_gateway") as mock_gw,
        patch("src.integrations.discord_app._run_pipeline", new_callable=AsyncMock) as mock_pipeline,
        patch("src.integrations.discord_app.settings") as mock_settings,
        patch("src.integrations.discord_app.httpx") as mock_httpx,
    ):
        mock_gw.bot_user_id = "bot123"
        mock_settings.discord_bot_token.get_secret_value.return_value = "fake-token"

        await handle_message_create(data)
        import asyncio
        await asyncio.sleep(0.01)
        mock_pipeline.assert_not_called()

    _processed_ids.clear()


@pytest.mark.asyncio
async def test_handle_message_create_ignores_non_trigger_channel() -> None:
    """handle_message_create ignores messages in channels not in trigger list."""
    from src.integrations.discord_app import handle_message_create, _processed_ids

    _processed_ids.clear()
    data = {
        "guild_id": "g1",
        "channel_id": "wrong_channel",
        "id": "wrong_ch_123",
        "author": {"id": "user1", "bot": False},
        "content": "Hello bot",
        "mentions": [{"id": "bot123"}],
    }

    with (
        patch("src.integrations.discord_app.discord_gateway") as mock_gw,
        patch("src.integrations.discord_app.get_org_by_discord", new_callable=AsyncMock) as mock_get_org,
        patch("src.integrations.discord_app._run_pipeline", new_callable=AsyncMock) as mock_pipeline,
        patch("src.integrations.discord_app.settings") as mock_settings,
        patch("src.integrations.discord_app.httpx") as mock_httpx,
    ):
        mock_gw.bot_user_id = "bot123"
        mock_get_org.return_value = {
            "id": "org1",
            "discord_trigger_channels": ["correct_channel"],
        }
        mock_settings.discord_bot_token.get_secret_value.return_value = "fake-token"

        await handle_message_create(data)
        import asyncio
        await asyncio.sleep(0.01)
        mock_pipeline.assert_not_called()

    _processed_ids.clear()


@pytest.mark.asyncio
async def test_handle_message_create_dispatches_on_mention_in_trigger_channel() -> None:
    """handle_message_create dispatches when bot is mentioned in trigger channel."""
    from src.integrations.discord_app import handle_message_create, _processed_ids

    _processed_ids.clear()
    data = {
        "guild_id": "g1",
        "channel_id": "trigger_ch",
        "id": "valid_123",
        "author": {"id": "user1", "bot": False},
        "content": "How do I reset my password?",
        "mentions": [{"id": "bot123"}],
    }

    with (
        patch("src.integrations.discord_app.discord_gateway") as mock_gw,
        patch("src.integrations.discord_app.get_org_by_discord", new_callable=AsyncMock) as mock_get_org,
        patch("src.integrations.discord_app._run_pipeline", new_callable=AsyncMock) as mock_pipeline,
        patch("src.integrations.discord_app.settings") as mock_settings,
        patch("src.integrations.discord_app.httpx") as mock_httpx,
    ):
        mock_gw.bot_user_id = "bot123"
        mock_get_org.return_value = {
            "id": "org1",
            "discord_trigger_channels": ["trigger_ch"],
        }
        mock_settings.discord_bot_token.get_secret_value.return_value = "fake-token"
        mock_response = AsyncMock()
        mock_response.status_code = 204
        mock_httpx.AsyncClient.return_value.__aenter__ = AsyncMock(
            return_value=AsyncMock(put=AsyncMock(return_value=mock_response))
        )
        mock_httpx.AsyncClient.return_value.__aexit__ = AsyncMock(return_value=False)

        await handle_message_create(data)
        import asyncio
        await asyncio.sleep(0.01)
        mock_pipeline.assert_called_once()

    _processed_ids.clear()
```

- [ ] **Step 2: Add trigger channels API tests**

Add to `tests/api/test_discord_routes.py`:

```python
@pytest.mark.asyncio
async def test_get_trigger_channels_returns_list() -> None:
    """GET /api/discord/trigger-channels returns the channel list."""
    from src.api.routes.discord import get_trigger_channels

    mock_token = {"org_id": "org_123"}

    with patch("src.api.routes.discord.fetch_one", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = {"discord_trigger_channels": ["ch1", "ch2"]}
        result = await get_trigger_channels(mock_token)

    assert result["channels"] == ["ch1", "ch2"]


@pytest.mark.asyncio
async def test_set_trigger_channels_saves() -> None:
    """POST /api/discord/trigger-channels saves the channel list."""
    from src.api.routes.discord import TriggerChannelsRequest, set_trigger_channels

    mock_token = {"org_id": "org_123"}

    with patch("src.api.routes.discord.execute", new_callable=AsyncMock) as mock_exec:
        request = TriggerChannelsRequest(channels=["ch1", "ch2", "ch3"])
        result = await set_trigger_channels(request, mock_token)

    assert result["channels"] == ["ch1", "ch2", "ch3"]
    mock_exec.assert_called_once()
```

- [ ] **Step 3: Run all Discord tests**

```bash
uv run pytest tests/api/test_discord_routes.py tests/test_discord_runner.py tests/integrations/test_discord_gateway.py tests/integrations/test_discord_app.py -v
```

- [ ] **Step 4: Commit**

```bash
git add tests/api/test_discord_routes.py tests/integrations/test_discord_app.py
git commit -m "test(discord): add mention+channel gate and trigger channels API tests"
```

---

## Execution Order

```
Task 1 (migration)          ← no dependencies
Task 2 (API endpoints)      ← depends on Task 1
Task 3 (invite URL)         ← parallel with Task 2
Task 4 (frontend API/types) ← depends on Task 2
Task 5 (Settings UI)        ← depends on Task 4
Task 6 (gateway bot ID)     ← no dependencies, parallel with 1-5
Task 7 (event handler)      ← depends on Task 1 + Task 6
Task 8 (tests)              ← depends on all above
```

Tasks 1-6 can run in parallel after Task 1. Task 7 depends on Task 1 (migration) and Task 6 (bot ID). Task 8 is final verification.
