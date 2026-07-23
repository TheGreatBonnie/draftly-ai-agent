# Slack Support Requests Implementation Plan

**Project:** Draftly - Autonomous Documentation Engineering
**Feature:** Slack Support Requests Solution Workflow
**Date:** 2026-07-23
**Status:** Ready to Implement
**Design Spec:** `docs/superpowers/specs/2026-07-23-slack-support-requests-design.md`

---

## Executive Summary

Add end-to-end Slack support request processing using Slack Bolt for Python. When a user @mentions the bot or posts in a DM, the system ingests the message, runs the 8-node LangGraph pipeline, and replies with generated documentation. Bolt handles OAuth, signature verification, event dedup, and interactivity — integrated into FastAPI via the `SlackRequestHandler` adapter.

---

## Implementation Steps

### Phase 1: Foundation (Migration + Config)

#### Step 1.1: Database Migration

**New file:** `infrastructure/cockroachdb/migrations/009_add_slack_tables.sql`

```sql
-- Slack installations (workspace-level OAuth tokens)
CREATE TABLE IF NOT EXISTS slack_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id STRING NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
    team_id STRING NOT NULL UNIQUE,
    team_name STRING NOT NULL,
    enterprise_id STRING,
    bot_user_id STRING NOT NULL,
    bot_token STRING NOT NULL,
    bot_scopes JSONB DEFAULT '[]'::jsonb,
    access_token STRING,
    user_id STRING,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now() ON UPDATE now()
);

CREATE INDEX idx_slack_installations_org ON slack_installations(org_id);
CREATE INDEX idx_slack_installations_team ON slack_installations(team_id);

-- Slack workflow runs
CREATE TABLE IF NOT EXISTS slack_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id STRING NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL,
    team_id STRING NOT NULL,
    channel_id STRING NOT NULL,
    thread_ts STRING NOT NULL,
    user_id STRING,
    status STRING DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_slack_workflows_status ON slack_workflows(status);
CREATE INDEX idx_slack_workflows_channel ON slack_workflows(channel_id, thread_ts);
```

#### Step 1.2: Config Additions

**File:** `src/config.py` — Add to `Settings` class:

```python
slack_client_id: str = ""
slack_client_secret: SecretStr = SecretStr("")
slack_redirect_uri: str = "http://localhost:8000/slack/oauth_redirect"
```

**File:** `.env.example` — Add:

```
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:8000/slack/oauth_redirect
```

---

### Phase 2: Bolt Integration Layer

#### Step 2.1: Custom `AsyncInstallationStore`

**New file:** `src/integrations/slack_store.py` (~90 lines)

Implements Bolt's `AsyncInstallationStore` interface backed by the `slack_installations` table.

```python
from slack_sdk.oauth.installation_store.async_installation_store import AsyncInstallationStore
from slack_sdk.oauth.installation_store import Bot, Installation
import structlog

logger = structlog.get_logger()


class CockroachInstallationStore(AsyncInstallationStore):
    """CockroachDB-backed installation store for Bolt OAuth."""

    @property
    def logger(self):
        return logger

    async def async_save(self, installation: Installation) -> None:
        """Save installation after OAuth callback."""
        from src.database import fetch_one
        import json

        team_id = installation.team_id
        if not team_id:
            return

        existing = await fetch_one(
            "SELECT id::text FROM slack_installations WHERE team_id = $1",
            team_id,
        )

        values = {
            "org_id": "",  # Will be linked separately via OAuth state
            "team_id": team_id,
            "team_name": "",  # Resolved from Slack API if needed
            "enterprise_id": installation.enterprise_id,
            "bot_user_id": installation.bot_user_id or "",
            "bot_token": installation.bot_token or "",
            "bot_scopes": json.dumps(installation.bot_scopes or []),
            "access_token": installation.access_token,
            "user_id": installation.user_id,
        }

        if existing:
            await fetch_one(
                """UPDATE slack_installations
                   SET bot_token = $1, bot_user_id = $2, bot_scopes = $3,
                       access_token = $4, updated_at = now()
                   WHERE team_id = $5""",
                values["bot_token"], values["bot_user_id"], values["bot_scopes"],
                values["access_token"], team_id,
            )
        else:
            await fetch_one(
                """INSERT INTO slack_installations
                   (org_id, team_id, team_name, enterprise_id, bot_user_id,
                    bot_token, bot_scopes, access_token, user_id)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
                values["org_id"], values["team_id"], values["team_name"],
                values["enterprise_id"], values["bot_user_id"], values["bot_token"],
                values["bot_scopes"], values["access_token"], values["user_id"],
            )

        logger.info("slack_installation_saved", team_id=team_id)

    async def async_find_bot(
        self, *, enterprise_id: str | None, team_id: str | None,
        is_enterprise_install: bool | None = False,
    ) -> Bot | None:
        """Find bot token for workspace. Called on every Bolt event."""
        from src.database import fetch_one

        if not team_id:
            return None

        row = await fetch_one(
            "SELECT bot_token, bot_user_id, enterprise_id FROM slack_installations WHERE team_id = $1",
            team_id,
        )
        if not row:
            return None

        return Bot(
            bot_token=row["bot_token"],
            bot_user_id=row["bot_user_id"],
            enterprise_id=row["enterprise_id"],
            team_id=team_id,
        )

    async def async_find_installation(
        self, *, enterprise_id: str | None, team_id: str | None,
        user_id: str | None = None, is_enterprise_install: bool | None = False,
    ) -> Installation | None:
        """Find full installation. Used for user token resolution."""
        from src.database import fetch_one

        if not team_id:
            return None

        row = await fetch_one(
            """SELECT bot_token, bot_user_id, enterprise_id, team_id,
                      access_token, user_id
               FROM slack_installations WHERE team_id = $1""",
            team_id,
        )
        if not row:
            return None

        return Installation(
            enterprise_id=row["enterprise_id"],
            team_id=row["team_id"],
            bot_token=row["bot_token"],
            bot_user_id=row["bot_user_id"],
            user_id=row.get("user_id"),
            access_token=row.get("access_token"),
        )

    async def async_delete_bot(
        self, *, enterprise_id: str | None, team_id: str | None,
    ) -> None:
        from src.database import execute
        if team_id:
            await execute("DELETE FROM slack_installations WHERE team_id = $1", team_id)
            logger.info("slack_installation_deleted", team_id=team_id)

    async def async_delete_installation(
        self, *, enterprise_id: str | None, team_id: str | None,
        user_id: str | None = None,
    ) -> None:
        from src.database import execute
        if team_id:
            await execute("DELETE FROM slack_installations WHERE team_id = $1", team_id)

    async def async_delete_all(
        self, *, enterprise_id: str | None, team_id: str | None,
    ) -> None:
        await self.async_delete_bot(enterprise_id=enterprise_id, team_id=team_id)
        await self.async_delete_installation(enterprise_id=enterprise_id, team_id=team_id)


installation_store = CockroachInstallationStore()
```

**Key gotcha:** `installation_store_bot_only=True` MUST be set on the `AsyncApp` to use `async_find_bot`. Without this, Bolt calls `async_find_installation` and returns "installation no longer available" (Bolt issue #1030).

#### Step 2.2: Bolt App + Event/Action Handlers

**New file:** `src/integrations/slack_app.py` (~80 lines)

```python
import asyncio
import logging
from slack_bolt.async_app import AsyncApp
from slack_bolt.oauth.async_oauth_settings import AsyncOAuthSettings

from src.config import settings
from src.integrations.slack_store import installation_store

logger = logging.getLogger(__name__)

slack_app = AsyncApp(
    signing_secret=settings.slack_signing_secret.get_secret_value(),
    oauth_settings=AsyncOAuthSettings(
        client_id=settings.slack_client_id,
        client_secret=settings.slack_client_secret.get_secret_value(),
        scopes=[
            "channels:history", "channels:read", "chat:write",
            "users:read", "groups:read", "im:read", "im:write",
        ],
        installation_store=installation_store,
        installation_store_bot_only=True,
        redirect_uri_path="/slack/oauth_redirect",
    ),
    logger=logger,
)


# --- Event Handlers ---

@slack_app.event("message")
async def handle_message(event, context, logger):
    """Handle message events. Bolt filters bot messages automatically."""
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

    logger.info("slack_message_received", team_id=team_id, channel=channel)


# --- Interactivity Handlers ---

@slack_app.action("approve_review")
async def handle_approve(ack, action, logger):
    await ack()
    from src.security.tokens import verify_review_token
    from src.memory.reviewer import complete_review
    from src.agents.runners.resume import resume_review

    token_data = verify_review_token(action.get("value", ""))
    if not token_data:
        return
    review_id = token_data["review_id"]
    await complete_review(review_id=review_id, status="approved", feedback=None)
    await resume_review(review_id=review_id, decision="approve", feedback="")
    logger.info("slack_review_approved", review_id=review_id)


@slack_app.action("reject_review")
async def handle_reject(ack, action, logger):
    await ack()
    from src.security.tokens import verify_review_token
    from src.memory.reviewer import complete_review
    from src.agents.runners.resume import resume_review

    token_data = verify_review_token(action.get("value", ""))
    if not token_data:
        return
    review_id = token_data["review_id"]
    await complete_review(review_id=review_id, status="rejected", feedback=None)
    await resume_review(review_id=review_id, decision="reject", feedback="")
    logger.info("slack_review_rejected", review_id=review_id)


@slack_app.action("revise_review")
async def handle_revise(ack, action, logger):
    await ack()
    from src.security.tokens import verify_review_token
    from src.memory.reviewer import complete_review
    from src.agents.runners.resume import resume_review

    token_data = verify_review_token(action.get("value", ""))
    if not token_data:
        return
    review_id = token_data["review_id"]
    await complete_review(review_id=review_id, status="needs_changes", feedback=None)
    await resume_review(review_id=review_id, decision="revise", feedback="")
    logger.info("slack_review_revise", review_id=review_id)


# Lazy import to avoid circular dependency
def run_slack_pipeline(*args, **kwargs):
    from src.agents.runners.slack_runner import run_slack_pipeline as _run
    return _run(*args, **kwargs)
```

**Note on lazy import:** `run_slack_pipeline` is imported inside the function to avoid circular imports between `slack_app.py` and `slack_runner.py`.

#### Step 2.3: FastAPI Route Rewrite

**File:** `src/api/routes/slack.py` — Rewrite (was 104 lines, now ~20)

```python
from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import Response
from slack_bolt.adapter.fastapi import SlackRequestHandler

from src.integrations.slack_app import slack_app

router = APIRouter()
handler = SlackRequestHandler(slack_app)


@router.post("/events")
async def slack_events(request: Request) -> Response:
    """Handle Slack Events API webhooks (message events, app_mention, etc.)."""
    return await handler.handle(request)


@router.post("/interactivity")
async def slack_interactivity(request: Request) -> Response:
    """Handle Slack interactivity webhooks (button clicks, dropdowns)."""
    return await handler.handle(request)


@router.get("/install")
async def slack_install(request: Request) -> Response:
    """Render 'Add to Slack' button page."""
    return await handler.handle(request)


@router.get("/oauth_redirect")
async def slack_oauth_redirect(request: Request) -> Response:
    """Handle OAuth callback from Slack."""
    return await handler.handle(request)
```

---

### Phase 3: Pipeline Runner

#### Step 3.1: Slack Runner

**New file:** `src/agents/runners/slack_runner.py` (~120 lines)

```python
from __future__ import annotations

import structlog
from langchain_cockroachdb import AsyncCockroachDBSaver

from src.agents.graph import build_hybrid_graph
from src.agents.state import DocumentationState
from src.config import settings

logger = structlog.get_logger()


def build_slack_state(
    team_id: str, channel: str, thread_ts: str, ts: str,
    text: str, user: str, org_id: str,
) -> DocumentationState:
    """Build initial DocumentationState from Slack message event."""
    graph_thread_id = f"slack-{channel}-{thread_ts}"

    return {
        "org_id": org_id,
        "source": "slack",
        "channel_id": channel,
        "thread_id": thread_ts,
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
            "team_id": team_id,
            "channel": channel,
            "thread_ts": thread_ts,
            "ts": ts,
            "user_id": user,
        },
    }


async def run_slack_pipeline(
    team_id: str, channel: str, thread_ts: str, ts: str,
    text: str, user: str,
) -> None:
    """Orchestrate the full Draftly pipeline for a Slack support request."""
    from src.database import close_pool, get_pool
    from src.memory.organizations import (
        get_org_by_slack,
        store_slack_workflow,
        update_slack_workflow_status,
    )

    await get_pool()

    try:
        org = await get_org_by_slack(team_id)
        if not org:
            logger.error("slack_pipeline_org_not_found", team_id=team_id)
            return
        org_id = org["id"]

        state = build_slack_state(team_id, channel, thread_ts, ts, text, user, org_id)
        config = {"configurable": {"thread_id": state["graph_thread_id"]}}

        from uuid import uuid4

        workflow_id = str(uuid4())
        await store_slack_workflow(
            org_id=org_id, workflow_id=workflow_id, team_id=team_id,
            channel_id=channel, thread_ts=thread_ts, user_id=user,
        )
        await update_slack_workflow_status(workflow_id, "running")

        async with AsyncCockroachDBSaver.from_conn_string(settings.cockroachdb_url) as checkpointer:
            await checkpointer.setup()
            graph = build_hybrid_graph().compile(checkpointer=checkpointer)
            result = await graph.ainvoke(state, config)

        if result.get("human_decision") == "":
            await update_slack_workflow_status(workflow_id, "pending")
            logger.info("slack_pipeline_paused", team_id=team_id, channel=channel)
        else:
            await update_slack_workflow_status(workflow_id, "completed")

    except Exception as e:
        logger.error("slack_pipeline_failed", error=str(e))
        try:
            from src.integrations.slack import send_slack_message
            await send_slack_message(channel, f"Error processing request: {e}", thread_ts=ts)
        except Exception:
            logger.error("failed_to_post_slack_error")
    finally:
        await close_pool()
```

#### Step 3.2: DB Layer Functions

**File:** `src/memory/organizations.py` — Add functions:

```python
async def get_org_by_slack(team_id: str) -> dict | None:
    """Find organization by Slack team_id via slack_installations."""
    row = await fetch_one(
        """SELECT o.clerk_org_id as id, o.clerk_org_name as name,
                  si.team_id, si.team_name
           FROM slack_installations si
           JOIN organizations o ON o.clerk_org_id = si.org_id
           WHERE si.team_id = $1""",
        team_id,
    )
    return dict(row) if row else None


async def store_slack_workflow(
    org_id: str, workflow_id: str, team_id: str,
    channel_id: str, thread_ts: str, user_id: str | None = None,
) -> str:
    """Store a Slack workflow for tracking."""
    row = await fetch_one(
        """INSERT INTO slack_workflows
           (org_id, workflow_id, team_id, channel_id, thread_ts, user_id)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text""",
        org_id, workflow_id, team_id, channel_id, thread_ts, user_id,
    )
    logger.info("slack_workflow_stored", org_id=org_id, team_id=team_id)
    return row["id"]


async def update_slack_workflow_status(workflow_id: str, status: str) -> None:
    """Update Slack workflow status."""
    from src.database import execute
    await execute(
        """UPDATE slack_workflows
           SET status = $1,
               completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN now()
                                   ELSE completed_at END
           WHERE workflow_id = $2""",
        status, workflow_id,
    )


async def list_slack_installations() -> list[dict]:
    """List all Slack installations with org names."""
    rows = await fetch_all(
        """SELECT si.id::text, si.team_id, si.team_name, si.bot_user_id,
                  si.created_at, si.updated_at, o.clerk_org_name as org_name
           FROM slack_installations si
           JOIN organizations o ON o.clerk_org_id = si.org_id
           ORDER BY si.created_at DESC"""
    )
    return [dict(r) for r in rows]
```

---

### Phase 4: Pipeline Node Changes

#### Step 4.1: Research Node — Wire Slack Tools

**File:** `src/agents/nodes/research.py`

After the web search loop (around line 60), before the LLM synthesis call, add:

```python
# Source-specific research
slack_context = []
if state.get("source") == "slack":
    from src.agents.tools.slack_tools import search_slack_messages
    try:
        slack_result = await search_slack_messages.ainvoke({
            "query": question, "limit": 3
        })
        if slack_result and "No relevant" not in slack_result:
            slack_context = [slack_result]
    except Exception as e:
        logger.warning("slack_search_failed", error=str(e))
```

Update the return dict to include `"slack_context": slack_context` instead of `"slack_context": []`.

#### Step 4.2: Publish Node — Token Resolution

**File:** `src/agents/nodes/publish.py`

Update `_reply_to_slack()` to resolve workspace-specific token:

```python
async def _reply_to_slack(state: DocumentationState, metadata: dict) -> None:
    """Reply to a Slack thread with generated documentation."""
    from src.integrations.slack import send_slack_message

    channel = metadata["channel"]
    thread_ts = metadata.get("thread_ts")
    team_id = metadata.get("team_id")
    body = _build_reply_body(state)

    # Resolve workspace-specific bot token via InstallationStore
    token = None
    if team_id:
        from src.integrations.slack_store import installation_store
        bot = await installation_store.async_find_bot(
            enterprise_id=None, team_id=team_id,
        )
        if bot:
            token = bot.bot_token

    await send_slack_message(channel=channel, text=body, thread_ts=thread_ts, token=token)
    logger.info("reply_posted_slack", channel=channel, thread_ts=thread_ts)
```

#### Step 4.3: Slack Integration — Token Parameter

**File:** `src/integrations/slack.py`

Add optional `token` parameter to `send_slack_message()`:

```python
async def send_slack_message(
    channel: str,
    text: str,
    thread_ts: str | None = None,
    blocks: list[dict] | None = None,
    token: str | None = None,  # NEW: workspace-specific token
) -> dict:
    if not token:
        token = settings.slack_bot_token.get_secret_value()
    # ... rest unchanged
```

#### Step 4.4: Bugfix — `source_type` → `source`

**File:** `src/agents/nodes/human.py:24`

```python
# Before:
source = str(state.get("source_type", "unknown"))
# After:
source = str(state.get("source", "unknown"))
```

---

### Phase 5: Frontend

#### Step 5.1: Slack API Client

**New file:** `frontend/src/api/slack.ts`

```typescript
import { request } from "./client";
import type { SlackInstallation } from "./types";

export async function listSlackInstallations(): Promise<SlackInstallation[]> {
  return request<SlackInstallation[]>("/slack/installations");
}
```

Note: No `getSlackOAuthUrl()` needed — Bolt renders the install page at `/api/slack/install`.

#### Step 5.2: TypeScript Types

**File:** `frontend/src/api/types.ts` — Add:

```typescript
export interface SlackInstallation {
  id: string;
  team_id: string;
  team_name: string;
  bot_user_id: string;
  created_at: string;
  updated_at: string;
  org_name: string;
}
```

#### Step 5.3: Settings Page

**File:** `frontend/src/pages/Settings.tsx`

Add imports:
```typescript
import { listSlackInstallations } from "../api/slack";
import type { SlackInstallation } from "../api/types";
```

Add state:
```typescript
const [slackInstallations, setSlackInstallations] = useState<SlackInstallation[]>([]);
```

Add to `fetchData`:
```typescript
const slackInsts = await listSlackInstallations();
setSlackInstallations(slackInsts);
```

Add Slack section after the GitHub section (before closing `</div>`):
```tsx
{/* Slack Integration section */}
<section className="rounded-lg border border-gray-200 p-6">
  <h2 className="text-lg font-semibold text-gray-900">Slack Integration</h2>
  <p className="mt-1 text-sm text-gray-500">
    Connect Draftly to your Slack workspace to automatically generate documentation from support requests.
  </p>

  <div className="mt-4">
    <a
      href="/api/slack/install"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
    >
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.522h-6.313z" />
      </svg>
      Connect Slack Workspace
    </a>
  </div>

  {slackInstallations.length > 0 && (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-gray-700">Connected Workspaces</h3>
      <div className="mt-2 space-y-3">
        {slackInstallations.map((inst) => (
          <div
            key={inst.id}
            className="rounded-md border border-gray-200 bg-gray-50 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{inst.team_name}</span>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                Connected
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Bot ID: {inst.bot_user_id}
            </p>
          </div>
        ))}
      </div>
    </div>
  )}

  {slackInstallations.length === 0 && !loading && (
    <p className="mt-4 text-sm text-gray-400">
      No Slack workspaces connected yet. Click the button above to install Draftly.
    </p>
  )}
</section>
```

---

### Phase 6: Tests

#### Step 6.1: Runner Tests

**New file:** `tests/test_slack_runner.py` (~100 lines)

```python
from src.agents.runners.slack_runner import build_slack_state


class TestBuildSlackState:
    def test_build_slack_state_basic(self):
        state = build_slack_state(
            team_id="T123", channel="C456", thread_ts="1234567890.123",
            ts="1234567890.123", text="How do I configure webhooks?",
            user="U789", org_id="org-1",
        )
        assert state["org_id"] == "org-1"
        assert state["source"] == "slack"
        assert state["channel_id"] == "C456"
        assert state["thread_id"] == "1234567890.123"
        assert state["question"] == "How do I configure webhooks?"

    def test_build_slack_state_source_metadata(self):
        state = build_slack_state(
            team_id="T123", channel="C456", thread_ts="999.888",
            ts="999.888", text="Help", user="U789", org_id="org-1",
        )
        metadata = state["source_metadata"]
        assert metadata["team_id"] == "T123"
        assert metadata["channel"] == "C456"
        assert metadata["thread_ts"] == "999.888"
        assert metadata["user_id"] == "U789"

    def test_build_slack_state_threaded_message(self):
        state = build_slack_state(
            team_id="T1", channel="C1", thread_ts="parent.ts",
            ts="child.ts", text="Follow-up question", user="U1", org_id="org-1",
        )
        assert state["thread_id"] == "parent.ts"
        assert state["graph_thread_id"] == "slack-C1-parent.ts"

    def test_build_slack_state_initializes_defaults(self):
        state = build_slack_state(
            team_id="T1", channel="C1", thread_ts="1.1",
            ts="1.1", text="test", user="U1", org_id="org-1",
        )
        assert state["similar_threads"] == []
        assert state["existing_docs"] == []
        assert state["slack_context"] == []
        assert state["github_context"] == []
        assert state["knowledge_package"] == {}
        assert state["draft_content"] == ""
        assert state["confidence_score"] == 0.0
        assert state["human_decision"] == ""
```

#### Step 6.2: Installation Store Tests

**New file:** `tests/integrations/test_slack_store.py` (~80 lines)

```python
from unittest.mock import AsyncMock, patch
from slack_sdk.oauth.installation_store import Bot, Installation
from src.integrations.slack_store import CockroachInstallationStore


class TestCockroachInstallationStore:
    @pytest.fixture
    def store(self):
        return CockroachInstallationStore()

    @patch("src.integrations.slack_store.fetch_one", new_callable=AsyncMock)
    async def test_async_find_bot_found(self, mock_fetch, store):
        mock_fetch.return_value = {
            "bot_token": "xoxb-test",
            "bot_user_id": "U123",
            "enterprise_id": None,
        }
        bot = await store.async_find_bot(enterprise_id=None, team_id="T456")
        assert bot is not None
        assert bot.bot_token == "xoxb-test"
        assert bot.bot_user_id == "U123"

    @patch("src.integrations.slack_store.fetch_one", new_callable=AsyncMock)
    async def test_async_find_bot_not_found(self, mock_fetch, store):
        mock_fetch.return_value = None
        bot = await store.async_find_bot(enterprise_id=None, team_id="T999")
        assert bot is None

    async def test_async_find_bot_no_team_id(self, store):
        bot = await store.async_find_bot(enterprise_id=None, team_id=None)
        assert bot is None
```

#### Step 6.3: Bolt Integration Tests

**New file:** `tests/api/test_slack_bolt_integration.py` (~60 lines)

```python
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from src.api.app import app


@pytest.fixture
def client():
    return TestClient(app)


class TestSlackBoltIntegration:
    def test_events_endpoint_exists(self, client):
        """POST /api/slack/events accepts requests (Bolt handles verification)."""
        response = client.post(
            "/api/slack/events",
            json={"type": "url_verification", "challenge": "test-challenge"},
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 200
        assert response.json().get("challenge") == "test-challenge"

    def test_interactivity_endpoint_exists(self, client):
        """POST /api/slack/interactivity accepts requests."""
        response = client.post(
            "/api/slack/interactivity",
            content="payload={}",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert response.status_code == 200

    def test_install_page_renders(self, client):
        """GET /api/slack/install renders add-to-slack page."""
        response = client.get("/api/slack/install")
        assert response.status_code == 200
```

---

## Verification

After implementation, run:

```bash
# Lint
uv run ruff check src/

# Type check
uv run mypy src/

# Tests
uv run pytest tests/test_slack_runner.py tests/integrations/test_slack_store.py tests/api/test_slack_bolt_integration.py -v

# Apply migration
uv run python scripts/init_db.py

# Dev server
uv run uvicorn src.api.app:app --reload
```

Test the full flow:
1. Install the Slack App to a workspace via `/api/slack/install`
2. @mention the bot in a channel with a support question
3. Verify the pipeline runs and replies with documentation
4. Test approve/reject/revise buttons on review notifications

---

## Dependency Graph

```
Phase 1 (Foundation)
  └─ Step 1.1: Migration
  └─ Step 1.2: Config

Phase 2 (Bolt Integration) [depends on Phase 1]
  └─ Step 2.1: InstallationStore [depends on 1.1]
  └─ Step 2.2: Bolt App + Handlers [depends on 2.1]
  └─ Step 2.3: FastAPI Routes [depends on 2.2]

Phase 3 (Pipeline Runner) [depends on Phase 1]
  └─ Step 3.1: Slack Runner [depends on 1.1, 1.2]
  └─ Step 3.2: DB Functions [depends on 1.1]

Phase 4 (Pipeline Nodes) [depends on Phase 3]
  └─ Step 4.1: Research Node [depends on 3.1]
  └─ Step 4.2: Publish Node [depends on 2.1]
  └─ Step 4.3: Slack Token Param
  └─ Step 4.4: Bugfix

Phase 5 (Frontend) [depends on Phase 2]
  └─ Step 5.1: API Client
  └─ Step 5.2: Types
  └─ Step 5.3: Settings Page [depends on 5.1, 5.2]

Phase 6 (Tests) [depends on all phases]
  └─ Step 6.1: Runner Tests [depends on 3.1]
  └─ Step 6.2: Store Tests [depends on 2.1]
  └─ Step 6.3: Integration Tests [depends on 2.3]
```

---

## File Change Summary

| # | File | Type | Est. Lines |
|---|---|---|---|
| 1 | `infrastructure/cockroachdb/migrations/009_add_slack_tables.sql` | New | ~35 |
| 2 | `src/config.py` | Edit | +3 |
| 3 | `src/integrations/slack_store.py` | New | ~120 |
| 4 | `src/integrations/slack_app.py` | New | ~90 |
| 5 | `src/integrations/slack.py` | Edit | +5 |
| 6 | `src/api/routes/slack.py` | Rewrite | ~25 |
| 7 | `src/memory/organizations.py` | Edit | +60 |
| 8 | `src/agents/runners/slack_runner.py` | New | ~120 |
| 9 | `src/agents/nodes/research.py` | Edit | +15 |
| 10 | `src/agents/nodes/publish.py` | Edit | +15 |
| 11 | `src/agents/nodes/human.py` | Edit | +1 |
| 12 | `frontend/src/api/slack.ts` | New | ~10 |
| 13 | `frontend/src/api/types.ts` | Edit | +10 |
| 14 | `frontend/src/pages/Settings.tsx` | Edit | +55 |
| 15 | `.env.example` | Edit | +3 |
| 16 | `tests/test_slack_runner.py` | New | ~70 |
| 17 | `tests/integrations/test_slack_store.py` | New | ~50 |
| 18 | `tests/api/test_slack_bolt_integration.py` | New | ~40 |
