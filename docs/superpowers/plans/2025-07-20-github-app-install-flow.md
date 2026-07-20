# GitHub App Install Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to install the Draftly GitHub App from the Draftly web app via a Settings page, with backend handling of installation lifecycle events.

**Architecture:** The frontend Settings page provides an "Install GitHub App" button that redirects to GitHub's install URL. GitHub pings the webhook with `installation.created`/`deleted` events, and redirects back to a setup callback endpoint. The backend stores installation records and surfaces them to the frontend via a list endpoint.

**Tech Stack:** FastAPI (Python), React 19 + React Router, asyncpg (CockroachDB), GitHub App API

---

### Task 1: Add `GITHUB_APP_SLUG` configuration

**Files:**
- Modify: `src/config.py:28-31`
- Modify: `.env:21-23`
- Modify: `.env.example:21-24`

- [ ] **Step 1: Add `github_app_slug` to Settings**

In `src/config.py`, add after line 31 (`github_private_key_path`):

```python
    github_app_slug: str = ""
```

- [ ] **Step 2: Add `GITHUB_APP_SLUG` to `.env`**

In `.env`, add after line 23 (`GITHUB_PRIVATE_KEY_PATH`):

```
GITHUB_APP_SLUG=draftly
```

The slug is the app name used in `https://github.com/apps/<SLUG>/installations/new`. Find it by going to GitHub.com > Settings > Developer Settings > GitHub Apps > select your app > the slug is in the URL or under "Public page".

- [ ] **Step 3: Add `GITHUB_APP_SLUG` to `.env.example`**

In `.env.example`, add after line 24 (`GITHUB_PRIVATE_KEY_PATH=./private-key.pem`):

```
# GitHub App slug (used to build the installation URL)
GITHUB_APP_SLUG=your-app-slug
```

- [ ] **Step 4: Commit**

```bash
git add src/config.py .env .env.example
git commit -m "feat: add GITHUB_APP_SLUG config"
```

---

### Task 2: Add `GET /api/github/install-url` endpoint

**Files:**
- Modify: `src/api/routes/github.py`

This endpoint lets the frontend discover the install URL without hardcoding the slug on the client.

- [ ] **Step 1: Add the endpoint**

In `src/api/routes/github.py`, add after the imports and before the webhook handler:

```python
from src.config import settings


@router.get("/install-url")
async def github_install_url():
    if not settings.github_app_slug:
        raise HTTPException(status_code=500, detail="GitHub App slug not configured")
    return {"install_url": f"https://github.com/apps/{settings.github_app_slug}/installations/new"}
```

The existing import of `from src.integrations.github_app import ...` and `from pydantic import BaseModel` are already in place. The `HTTPException` import is also already present.

- [ ] **Step 2: Verify endpoint works**

Run: `uv run uvicorn src.api.app:app --port 8000` then:

```bash
curl -s http://localhost:8000/api/github/install-url | python3 -m json.tool
```

Expected:
```json
{
    "install_url": "https://github.com/apps/draftly/installations/new"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/api/routes/github.py
git commit -m "feat: add GET /api/github/install-url endpoint"
```

---

### Task 3: Add `remove_github_installation` and `list_github_installations` to organizations module

**Files:**
- Modify: `src/memory/organizations.py`

- [ ] **Step 1: Add `remove_github_installation`**

In `src/memory/organizations.py`, add after line 110 (`return row["id"]` at end of `store_github_installation`):

```python
async def remove_github_installation(installation_id: int) -> None:
    """Delete a GitHub App installation record."""
    from src.database import execute

    await execute(
        "DELETE FROM github_installations WHERE installation_id = $1",
        installation_id,
    )
    logger.info("github_installation_removed", installation_id=installation_id)
```

- [ ] **Step 2: Add `list_github_installations`**

In `src/memory/organizations.py`, add after `remove_github_installation`:

```python
async def list_github_installations() -> list[dict]:
    """List all GitHub App installations with org names."""
    from src.database import fetch_all

    rows = await fetch_all(
        """SELECT gi.id::text, gi.installation_id, gi.github_org, gi.repositories,
                  gi.created_at, gi.updated_at, o.name as org_name
           FROM github_installations gi
           JOIN organizations o ON o.id = gi.org_id::uuid
           ORDER BY gi.created_at DESC"""
    )
    return [dict(row) for row in rows]
```

- [ ] **Step 3: Commit**

```bash
git add src/memory/organizations.py
git commit -m "feat: add remove/list github installation functions"
```

---

### Task 4: Handle `installation.created` and `installation.deleted` webhook events

**Files:**
- Modify: `src/api/routes/github.py`

The current webhook handler ignores all events except `issues.opened`. We need to handle `installation.created` (store the installation record) and `installation.deleted` (remove it).

- [ ] **Step 1: Add installation event handling**

In `src/api/routes/github.py`, modify the webhook handler to add an `elif` for `event_type == "installation"` before the `# 5. Ignore other events` fallthrough.

Replace the webhook handler body (lines 22-66) with:

```python
@router.post("/webhook")
async def github_webhook(request: Request, background_tasks: BackgroundTasks) -> WebhookResponse:
    """Receive and process GitHub webhook events."""
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")

    if signature is None or not verify_webhook_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = request.headers.get("X-GitHub-Event")

    # Handle installation events (created/deleted)
    if event_type == "installation":
        from src.memory.organizations import (
            get_or_create_org,
            list_github_installations,
            remove_github_installation,
            store_github_installation,
        )

        action = payload.get("action")
        installation = payload["installation"]
        installation_id = installation["id"]
        account = installation["account"]
        github_org = account["login"]

        if action == "created":
            repositories = [
                {"full_name": repo["full_name"], "id": repo["id"]}
                for repo in payload.get("repositories", [])
            ]
            org_id = await get_or_create_org(github_org=github_org)
            await store_github_installation(
                org_id=org_id,
                installation_id=installation_id,
                github_org=github_org,
                repositories=repositories,
            )
            logger.info(
                "github_app_installed",
                installation_id=installation_id,
                org=github_org,
                repo_count=len(repositories),
            )

        elif action == "deleted":
            await remove_github_installation(installation_id)
            logger.info(
                "github_app_uninstalled",
                installation_id=installation_id,
                org=github_org,
            )

        return WebhookResponse(status=f"Installation {action}")

    # Handle issue events
    if event_type == "issues" and payload.get("action") == "opened":
        installation_id = payload["installation"]["id"]

        try:
            token = await get_installation_token(installation_id)
        except Exception as e:
            logger.error("failed_to_get_installation_token", error=str(e))
            raise HTTPException(status_code=500, detail="Failed to get installation token")

        background_tasks.add_task(run_github_pipeline, payload=payload, installation_token=token)

        logger.info(
            "github_webhook_received",
            event_type=event_type,
            action=payload.get("action"),
            repo=payload.get("repository", {}).get("full_name"),
            issue=payload.get("issue", {}).get("number"),
        )

        return WebhookResponse(status="Processing issue event")

    # Ignore other events
    logger.info("github_event_ignored", event_type=event_type)
    return WebhookResponse(status="Event ignored")
```

- [ ] **Step 2: Run existing tests to verify no regression**

```bash
uv run pytest tests/test_github_webhook.py -v
```

Expected: all tests pass (valid/invalid signature, non-issue events, malformed JSON scenarios).

- [ ] **Step 3: Commit**

```bash
git add src/api/routes/github.py
git commit -m "feat: handle installation.created and installation.deleted webhooks"
```

---

### Task 5: Add `GET /api/github/installations` endpoint

**Files:**
- Modify: `src/api/routes/github.py`

- [ ] **Step 1: Add the list endpoint**

In `src/api/routes/github.py`, add after the install-url endpoint:

```python
@router.get("/installations")
async def github_installations():
    from src.memory.organizations import list_github_installations

    return await list_github_installations()
```

- [ ] **Step 2: Verify endpoint responds**

```bash
curl -s http://localhost:8000/api/github/installations
```

Expected: `[]` (empty list) or a list of installation objects.

- [ ] **Step 3: Commit**

```bash
git add src/api/routes/github.py
git commit -m "feat: add GET /api/github/installations endpoint"
```

---

### Task 6: Add setup callback endpoint (GitHub post-install redirect)

**Files:**
- Modify: `src/api/routes/github.py`

When a user finishes installing the GitHub App on GitHub.com, GitHub can redirect them to a Setup URL. This endpoint catches that redirect and sends the user back to the frontend Settings page with a success indicator.

- [ ] **Step 1: Add setup callback endpoint**

In `src/api/routes/github.py`, add after the installations list endpoint:

```python
from fastapi.responses import RedirectResponse


@router.get("/setup-callback")
async def github_setup_callback(
    installation_id: int | None = None,
    setup_action: str | None = None,
):
    frontend_url = f"{settings.app_url}/settings"
    if installation_id:
        frontend_url += f"?github=connected&installation_id={installation_id}"
    return RedirectResponse(url=frontend_url)
```

This endpoint needs to be configured in your GitHub App settings at GitHub.com > Settings > Developer Settings > GitHub Apps > your app > "Setup URL". Set it to `https://your-app.com/api/github/setup-callback` (or `http://localhost:8000/api/github/setup-callback` for local dev).

- [ ] **Step 2: Commit**

```bash
git add src/api/routes/github.py
git commit -m "feat: add GET /api/github/setup-callback redirect endpoint"
```

---

### Task 7: Add frontend GitHub API client and types

**Files:**
- Create: `frontend/src/api/github.ts`
- Modify: `frontend/src/api/types.ts`

- [ ] **Step 1: Add GitHub types to `types.ts`**

Add at the end of `frontend/src/api/types.ts`:

```typescript
export interface GitHubInstallation {
  id: string;
  installation_id: number;
  github_org: string;
  repositories: { full_name: string; id: number }[];
  created_at: string;
  updated_at: string;
  org_name: string;
}

export interface GitHubInstallUrl {
  install_url: string;
}
```

- [ ] **Step 2: Create `frontend/src/api/github.ts`**

```typescript
import { request } from "./client";
import type { GitHubInstallation, GitHubInstallUrl } from "./types";

export async function getInstallUrl(): Promise<GitHubInstallUrl> {
  return request<GitHubInstallUrl>("/github/install-url");
}

export async function listInstallations(): Promise<GitHubInstallation[]> {
  return request<GitHubInstallation[]>("/github/installations");
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/github.ts frontend/src/api/types.ts
git commit -m "feat: add GitHub API client and types"
```

---

### Task 8: Add Settings page with GitHub installation section

**Files:**
- Create: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Header.tsx`

- [ ] **Step 1: Create `frontend/src/pages/Settings.tsx`**

```typescript
import { useEffect, useState } from "react";
import { getInstallUrl, listInstallations } from "../api/github";
import type { GitHubInstallation, GitHubInstallUrl } from "../api/types";

export function Settings() {
  const [installUrl, setInstallUrl] = useState<GitHubInstallUrl | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [urlResult, installs] = await Promise.all([
        getInstallUrl(),
        listInstallations(),
      ]);
      setInstallUrl(urlResult);
      setInstallations(installs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Re-fetch when the page gains focus (e.g., returning from GitHub install)
  useEffect(() => {
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (loading) {
    return <p className="text-gray-500">Loading settings...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* GitHub Integration section */}
      <section className="rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">GitHub Integration</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect Draftly to your GitHub repositories to automatically generate documentation from issues.
        </p>

        <div className="mt-4">
          {installUrl && (
            <a
              href={installUrl.install_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Install GitHub App
            </a>
          )}
        </div>

        {installations.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700">Connected Organizations</h3>
            <div className="mt-2 space-y-3">
              {installations.map((inst) => (
                <div
                  key={inst.id}
                  className="rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{inst.github_org}</span>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Connected
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {inst.repositories.length} repository{inst.repositories.length !== 1 ? "ies" : "y"} accessible
                  </p>
                  {inst.repositories.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {inst.repositories.map((repo: { full_name: string }) => (
                        <span
                          key={repo.full_name}
                          className="inline-block rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600"
                        >
                          {repo.full_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {installations.length === 0 && !loading && (
          <p className="mt-4 text-sm text-gray-400">
            No GitHub organizations connected yet. Click the button above to install the Draftly GitHub App.
          </p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add `/settings` route in `App.tsx`**

Modify `frontend/src/App.tsx` to add the import and route:

```typescript
import { Settings } from "./pages/Settings";
```

Add after the `<Route path="memory" ... />` line:

```typescript
          <Route path="settings" element={<Settings />} />
```

- [ ] **Step 3: Wire up the gear icon in `Header.tsx`**

In `frontend/src/components/Header.tsx`, change the settings button (lines 67-85) to be a `<Link>` instead of a `<button>`:

First, add the import at the top:

```typescript
import { useLocation, Link } from "react-router";
```

Then replace the button (lines 67-85) with:

```typescript
        <Link
          to="/settings"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Settings"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </Link>
```

Also add `/settings` to the `routeLabels` map in `Header.tsx` so the breadcrumb shows correctly:

```typescript
const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/reviewers": "Reviewers",
  "/docs": "Documentation",
  "/memory": "Memory",
  "/settings": "Settings",
};
```

- [ ] **Step 4: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors. If there are errors, fix them.

- [ ] **Step 5: Run existing tests**

```bash
uv run pytest -v
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Settings.tsx frontend/src/App.tsx frontend/src/components/Header.tsx
git commit -m "feat: add Settings page with GitHub install flow"
```

---

### Post-Implementation: Configure GitHub App

After deploying, configure these in your GitHub App settings (GitHub.com > Settings > Developer Settings > GitHub Apps > your app):

1. **Setup URL:** `https://your-app.com/api/github/setup-callback` (so users return to Draftly after installing)
2. **Webhook URL:** `https://your-app.com/api/github/webhook` (if not already set)
3. **Repository permissions:** Issues (Read & Write), Metadata (Read-only)
4. **Subscribe to events:** Issues, Installation (check both)
