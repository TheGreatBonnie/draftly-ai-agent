# Bolt OAuth Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bolt's broken OAuth flow with a custom implementation matching GitHub's pattern.

**Architecture:** Bypass Bolt's built-in OAuth entirely. Custom endpoints handle install URL generation and code exchange. Bolt is kept only for event/interactivity signature verification.

**Tech Stack:** FastAPI, httpx (Slack API calls), slack-sdk (InstallationStore models), CockroachDB

---

### Task 1: Add `GET /api/slack/install-url` endpoint

**Files:**
- Modify: `src/api/routes/slack.py:32-35`
- Modify: `src/config.py:22`

- [ ] **Step 1: Add `slack_redirect_uri` default to config**

In `src/config.py`, the `slack_redirect_uri` already exists at line 22. Verify it points to the correct callback path:

```python
slack_redirect_uri: str = "https://grit-flagstone-recreate.ngrok-free.dev/api/slack/oauth/callback"
```

No change needed if already set correctly.

- [ ] **Step 2: Write the `GET /install-url` endpoint**

Replace the existing `GET /install` Bolt passthrough in `src/api/routes/slack.py` with a new `GET /install-url` endpoint:

```python
@router.get("/install-url")
async def slack_install_url(token: dict = Depends(get_verified_token)):
    """Return the Slack OAuth authorization URL."""
    if not settings.slack_client_id:
        raise HTTPException(status_code=500, detail="Slack client ID not configured")

    scopes = ",".join([
        "app_mentions:read", "channels:history", "channels:read", "chat:write",
        "groups:history", "groups:read", "im:history", "im:read", "im:write",
        "reactions:write", "reactions:read", "users:read", "assistant:write",
    ])
    user_scopes = ",".join([
        "search:read", "channels:history", "channels:read", "groups:history",
        "groups:read", "im:history", "mpim:history", "users:read", "chat:write",
        "canvases:read", "canvases:write", "users:read.email",
    ])

    install_url = (
        f"https://slack.com/oauth/v2/authorize"
        f"?client_id={settings.slack_client_id}"
        f"&scope={scopes}"
        f"&user_scope={user_scopes}"
        f"&redirect_uri={settings.slack_redirect_uri}"
    )
    return {"install_url": install_url}
```

- [ ] **Step 3: Remove the old `GET /install` route**

Delete lines 32-35 in `src/api/routes/slack.py`:

```python
# DELETE THIS:
@router.get("/install")
async def slack_install(request: Request) -> Response:
    """Render 'Add to Slack' button page."""
    return await handler.handle(request)
```

- [ ] **Step 4: Run lint**

Run: `uv run ruff check src/api/routes/slack.py`
Expected: All checks passed

---

### Task 2: Replace `GET /api/slack/oauth/callback` with custom handler

**Files:**
- Modify: `src/api/routes/slack.py:38-41`

- [ ] **Step 1: Write the failing test**

Create `tests/api/test_slack_oauth.py`:

```python
"""Tests for custom Slack OAuth callback."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
@patch("src.api.routes.slack.httpx.AsyncClient")
@patch("src.api.routes.slack.installation_store")
async def test_oauth_callback_exchanges_code(mock_store: AsyncMock, mock_httpx: AsyncMock) -> None:
    """Callback exchanges authorization code for tokens."""
    from src.api.routes.slack import slack_oauth_callback

    mock_response = AsyncMock()
    mock_response.json.return_value = {
        "ok": True,
        "access_token": "xoxb-fake-bot-token",
        "team": {"id": "T12345", "name": "Test Workspace"},
        "bot_user_id": "U_BOT",
        "scope": "chat:write,channels:read",
        "authed_user": {
            "id": "U12345",
            "access_token": "xoxp-fake-user-token",
            "scope": "search:read",
        },
    }
    mock_response.raise_for_status = AsyncMock()
    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_httpx.return_value = mock_client

    mock_store.async_save = AsyncMock()

    response = await slack_oauth_callback(code="test_code_123", state="")

    assert response.status_code == 307
    assert "team_id=T12345" in response.headers["location"]
    mock_store.async_save.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/api/test_slack_oauth.py -v`
Expected: FAIL (module `src.api.routes.slack` has no attribute `slack_oauth_callback`)

- [ ] **Step 3: Write the custom callback handler**

Replace the Bolt passthrough in `src/api/routes/slack.py`:

```python
import httpx
from fastapi.responses import RedirectResponse

@router.get("/oauth/callback")
async def slack_oauth_callback(code: str, state: str = "") -> RedirectResponse:
    """Exchange authorization code for tokens and save installation."""
    from slack_sdk.oauth.installation_store.models.installation import Installation

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "code": code,
                "client_id": settings.slack_client_id,
                "client_secret": settings.slack_client_secret.get_secret_value(),
            },
        )
        resp.raise_for_status()
        data = resp.json()

    if not data.get("ok"):
        logger.error("slack_oauth_failed", error=data.get("error"))
        raise HTTPException(status_code=400, detail=f"Slack OAuth failed: {data.get('error')}")

    team = data["team"]
    authed_user = data.get("authed_user", {})

    installation = Installation(
        team_id=team["id"],
        team_name=team["name"],
        bot_user_id=data.get("bot_user_id", ""),
        bot_token=data["access_token"],
        bot_scopes=data.get("scope", "").split(","),
        user_id=authed_user.get("id"),
        user_token=authed_user.get("access_token"),
        user_scopes=authed_user.get("scope", "").split(","),
        token_type="bot",
    )
    await installation_store.async_save(installation)

    logger.info("slack_oauth_success", team_id=team["id"], team_name=team["name"])

    frontend_url = f"{settings.app_url}/settings?slack=connected&team_id={team['id']}"
    return RedirectResponse(url=frontend_url)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/api/test_slack_oauth.py -v`
Expected: PASS

- [ ] **Step 5: Run all Slack tests**

Run: `uv run pytest tests/ -k slack -v`
Expected: All tests PASS

- [ ] **Step 6: Run lint**

Run: `uv run ruff check src/api/routes/slack.py`
Expected: All checks passed

---

### Task 3: Remove Bolt OAuth settings from `slack_app.py`

**Files:**
- Modify: `src/integrations/slack_app.py:20-67`

- [ ] **Step 1: Remove oauth_settings from AsyncApp**

In `src/integrations/slack_app.py`, remove the `_oauth_settings` variable and `oauth_settings` parameter. Keep `installation_store` and `installation_store_bot_only`:

```python
slack_app = AsyncApp(
    signing_secret=settings.slack_signing_secret.get_secret_value(),
    installation_store=installation_store,
    installation_store_bot_only=True,
    logger=bolt_logger,
)
```

Remove lines 20-59 (the entire `_oauth_settings` block).

- [ ] **Step 2: Remove unused imports**

Remove `AsyncOAuthSettings` from imports at line 10.

- [ ] **Step 3: Run lint**

Run: `uv run ruff check src/integrations/slack_app.py`
Expected: All checks passed

- [ ] **Step 4: Run all Slack tests**

Run: `uv run pytest tests/ -k slack -v`
Expected: All tests PASS (events + interactivity still work without OAuth settings)

---

### Task 4: Update frontend to fetch install URL dynamically

**Files:**
- Modify: `frontend/src/api/slack.ts`
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Add `getSlackInstallUrl` to API client**

In `frontend/src/api/slack.ts`, add:

```typescript
export async function getSlackInstallUrl(): Promise<{ install_url: string }> {
  return request("/slack/install-url");
}
```

- [ ] **Step 2: Update Settings.tsx to fetch install URL**

In `frontend/src/pages/Settings.tsx`:

1. Add import:
```typescript
import { getSlackInstallUrl, listSlackInstallations, linkSlackInstallation } from "../api/slack";
```

2. Add state for Slack install URL:
```typescript
const [slackInstallUrl, setSlackInstallUrl] = useState<string | null>(null);
```

3. In `fetchData`, add:
```typescript
const slackUrl = await getSlackInstallUrl();
setSlackInstallUrl(slackUrl.install_url);
```

4. Update the Slack section button to use dynamic URL:
```tsx
<a
  href={slackInstallUrl ?? "#"}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
>
```

- [ ] **Step 3: Run lint**

Run: `cd frontend && npm run lint` (if available)
Expected: No errors

---

### Task 5: Clean up unused Bolt adapter imports

**Files:**
- Modify: `src/api/routes/slack.py`

- [ ] **Step 1: Remove unused imports**

After Tasks 1-3, the following imports in `src/api/routes/slack.py` are no longer needed:
- `Response` from `fastapi.responses` (only `RedirectResponse` is used)
- `Request` from `fastapi` (no longer needed for Bolt handler)
- `AsyncSlackRequestHandler` from `slack_bolt.adapter.fastapi.async_handler`

Keep:
- `APIRouter`, `Depends`, `HTTPException` from `fastapi`
- `RedirectResponse` from `fastapi.responses`
- `httpx`
- `settings` from `src.config`
- `installation_store` from `src.integrations.slack_app`
- `logger` (structlog)

- [ ] **Step 2: Run full lint**

Run: `uv run ruff check src/`
Expected: All checks passed

- [ ] **Step 3: Run all tests**

Run: `uv run pytest tests/ -v`
Expected: All tests PASS

---

### Task 6: Update design spec and implementation plan

**Files:**
- Modify: `docs/superpowers/specs/2026-07-23-slack-support-requests-design.md`
- Modify: `docs/SLACK_SUPPORT_REQUESTS_PLAN.md`

- [ ] **Step 1: Update spec to document the OAuth change**

Add a section to the design spec noting that Bolt OAuth was replaced with a custom flow, and why.

- [ ] **Step 2: Update implementation plan**

Update Step 2.3 to reflect the new custom OAuth flow instead of Bolt passthrough.

---

## Verification

After all tasks complete:

```bash
# Lint
uv run ruff check src/

# Tests
uv run pytest tests/ -k slack -v
uv run pytest tests/api/test_slack_oauth.py -v

# Manual test
# 1. Open Settings page
# 2. Click "Connect Slack Workspace"
# 3. Complete Slack OAuth
# 4. Verify redirect to /settings?slack=connected&team_id=xxx
# 5. Verify installation appears in "Connected Workspaces"
# 6. Send @mention to bot in Slack
# 7. Verify pipeline runs and replies
```

---

## Dependency Graph

```
Task 1 (install-url endpoint)
  └─ Task 2 (custom callback) [depends on Task 1]
      └─ Task 3 (remove Bolt OAuth settings) [depends on Task 2]
          └─ Task 5 (cleanup imports) [depends on Task 3]
Task 4 (frontend) [depends on Task 1]
Task 6 (docs) [depends on all]
```
