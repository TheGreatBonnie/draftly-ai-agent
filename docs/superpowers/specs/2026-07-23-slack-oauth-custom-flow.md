# Design Spec: Replace Bolt OAuth with Custom Flow

**Date:** 2026-07-23
**Status:** Draft
**Author:** opencode

## Summary

Replace Slack Bolt's built-in OAuth flow with a custom implementation following the same pattern as GitHub's OAuth flow. Bolt's `is_valid_browser` state cookie check fails when the install page opens in a `target="_blank"` tab through a reverse proxy (Tailscale), causing a 400 on every callback.

## Motivation

Bolt's OAuth flow stores state in a `FileOAuthStateStore` and validates via a browser cookie (`slack-app-oauth-state`). The cookie gets lost when:
- The install page is opened via `target="_blank"` from a different origin
- The response goes through a reverse proxy (Tailscale HTTPS)
- The browser doesn't store/send the `Set-Cookie` header correctly

GitHub's OAuth pattern (already working in this codebase) avoids this entirely by:
1. Generating the install URL server-side (no cookie needed)
2. Handling the callback with a simple code exchange (no state cookie validation)
3. Redirecting to frontend with an identifier
4. Frontend calls an authenticated endpoint to link the installation

This eliminates the state cookie problem and creates a consistent pattern across both integrations.

## Architecture

### Current (Broken)

```
Frontend → /api/slack/install → Bolt HTML page (sets state cookie)
  → User clicks "Add to Slack" → Slack OAuth
  → Slack → /api/slack/oauth/callback?code=...&state=...
  → Bolt checks state cookie → COOKIE MISSING → 400
```

### Target

```
Frontend → GET /api/slack/install-url → { install_url: "https://slack.com/oauth/v2/authorize?..." }
  → User opens install URL → Slack OAuth
  → Slack → GET /api/slack/oauth/callback?code=...&state=...
  → Backend exchanges code → saves installation → redirects to /settings?slack=connected&team_id=xxx
  → Frontend detects team_id → calls POST /api/slack/link → links installation to org
```

### Flow Diagram

```
┌─────────────────────────────────────────┐
│  Settings Page                          │
│  frontend/src/pages/Settings.tsx        │
│                                         │
│  1. Fetch install URL from backend      │
│  2. Show "Connect Slack Workspace" btn  │
│  3. User clicks → opens Slack OAuth     │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  GET /api/slack/install-url             │
│  src/api/routes/slack.py                │
│                                         │
│  Build: https://slack.com/oauth/        │
│    v2/authorize?client_id=...           │
│    &scope=chat:write,channels:read...   │
│    &user_scope=search:read,...          │
│    &redirect_uri=...                    │
│  Return: { install_url }                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Slack OAuth Page (slack.com)           │
│  User clicks "Allow"                    │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  GET /api/slack/oauth/callback          │
│  src/api/routes/slack.py                │
│                                         │
│  1. Receive code + state from Slack     │
│  2. POST slack.com/api/oauth.v2.access  │
│     (code + client_id + client_secret)  │
│  3. Extract team_id, bot_token, scopes  │
│  4. Save via CockroachInstallationStore │
│  5. Redirect to /settings?slack=        │
│     connected&team_id={team_id}         │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Frontend detects team_id in URL        │
│  Calls POST /api/slack/link             │
│  (authenticated with Clerk JWT)         │
│                                         │
│  Updates slack_installations.org_id     │
│  Refreshes installations list           │
└─────────────────────────────────────────┘
```

## Components

### 1. Custom OAuth Callback Handler

**File:** `src/api/routes/slack.py`

Replace `GET /oauth/callback` from Bolt passthrough to custom handler:

```python
@router.get("/oauth/callback")
async def slack_oauth_callback(code: str, state: str = "") -> RedirectResponse:
    # Exchange code for tokens via Slack API
    # Save installation via CockroachInstallationStore
    # Redirect to frontend with team_id
```

**Slack API call:** `POST https://slack.com/api/oauth.v2.access`

**Request:** `application/x-www-form-urlencoded`
- `code` — authorization code from callback
- `client_id` — from settings
- `client_secret` — from settings

**Response:**
```json
{
    "ok": true,
    "access_token": "xoxb-...",
    "team": { "id": "T12345", "name": "Workspace" },
    "bot_user_id": "U_BOT",
    "scope": "chat:write,channels:read",
    "authed_user": {
        "id": "U12345",
        "access_token": "xoxp-...",
        "scope": "search:read"
    }
}
```

**Installation saved via:**
```python
await installation_store.async_save(Installation(
    team_id=resp["team"]["id"],
    team_name=resp["team"]["name"],
    bot_user_id=resp["bot_user_id"],
    bot_token=resp["access_token"],
    bot_scopes=resp["scope"].split(","),
    user_id=resp["authed_user"]["id"],
    user_token=resp["authed_user"]["access_token"],
    user_scopes=resp["authed_user"]["scope"].split(","),
    token_type="bot",
))
```

### 2. Install URL Endpoint

**File:** `src/api/routes/slack.py`

```python
@router.get("/install-url")
async def slack_install_url(token: dict = Depends(get_verified_token)):
    scopes = "app_mentions:read,channels:history,channels:read,chat:write,groups:history,groups:read,im:history,im:read,im:write,reactions:write,reactions:read,users:read,assistant:write"
    user_scopes = "search:read,channels:history,channels:read,groups:history,groups:read,im:history,mpim:history,users:read,chat:write,canvases:read,canvases:write,users:read.email"
    redirect_uri = settings.slack_redirect_uri
    install_url = (
        f"https://slack.com/oauth/v2/authorize"
        f"?client_id={settings.slack_client_id}"
        f"&scope={scopes}"
        f"&user_scope={user_scopes}"
        f"&redirect_uri={redirect_uri}"
    )
    return {"install_url": install_url}
```

### 3. Frontend API Client

**File:** `frontend/src/api/slack.ts`

```typescript
export async function getSlackInstallUrl(): Promise<{ install_url: string }> {
    return request("/slack/install-url");
}
```

### 4. Settings Page Changes

**File:** `frontend/src/pages/Settings.tsx`

- Fetch `install_url` from backend instead of hardcoding `/api/slack/install`
- Show loading state while fetching URL
- `team_id` auto-link already implemented (no changes needed)

### 5. Remove Bolt OAuth Settings

**File:** `src/integrations/slack_app.py`

Remove `oauth_settings` from `AsyncApp` constructor. Bolt is only used for:
- Event signature verification (Events API)
- Interactivity signature verification (button clicks)
- Event routing to handlers

OAuth is handled entirely by our custom code.

## Files Changed

| File | Change | Type |
|------|--------|------|
| `src/api/routes/slack.py` | Add `GET /install-url`, replace `GET /oauth/callback` | Edit |
| `src/integrations/slack_app.py` | Remove `oauth_settings` from `AsyncApp` | Edit |
| `frontend/src/api/slack.ts` | Add `getSlackInstallUrl()` | Edit |
| `frontend/src/pages/Settings.tsx` | Fetch install URL dynamically | Edit |

## Verification

1. **Lint:** `uv run ruff check src/`
2. **Tests:** `uv run pytest tests/ -k slack -v`
3. **Manual flow:**
   - Settings page shows "Connect Slack Workspace" button
   - Button opens Slack OAuth in new tab
   - After authorization, redirects back to Settings with `team_id` in URL
   - Installation appears in "Connected Workspaces" list
   - Bot receives messages and processes them
