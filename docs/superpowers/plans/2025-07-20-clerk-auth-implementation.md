# Clerk Auth + Organizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user authentication, multi-tenant organization management, and role-based access control to Draftly using Clerk.

**Architecture:** Frontend uses `@clerk/react` SDK for auth UI and JWT management; backend verifies Clerk JWTs per-request via a FastAPI dependency; Clerk webhooks sync user/org lifecycle events into CockroachDB. Existing `org_id`-scoped data model requires no schema changes — only new tables for user and membership storage.

**Tech Stack:** `@clerk/react` (frontend), `PyJWTClient` / `PyJWKClient` (backend JWT verification), Svix (webhook verification), FastAPI, CockroachDB, React 19, React Router

---

### Task 1: Install Clerk SDK + configure environment variables

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/.env`
- Create: `frontend/.env.example`
- Modify: `src/config.py`
- Modify: `.env`
- Modify: `.env.example`

- [ ] **Step 1: Install @clerk/react in frontend**

```bash
cd frontend && npm install @clerk/react@latest
```

- [ ] **Step 2: Add Clerk env vars to frontend `.env`**

Create `frontend/.env` if it doesn't exist:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Also add to `frontend/.env.example`:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-publishable-key
```

- [ ] **Step 3: Add Clerk config to backend `src/config.py`**

Add after the GitHub App settings (line 31):

```python
    # Clerk (auth + organizations)
    clerk_publishable_key: str = ""
    clerk_secret_key: SecretStr = SecretStr("")
    clerk_signing_secret: SecretStr = SecretStr("")
```

- [ ] **Step 4: Add Clerk backend env vars to `.env`**

Add to `.env`:

```
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_SIGNING_SECRET=whsec_...
```

- [ ] **Step 5: Add Clerk backend env vars to `.env.example`**

Add to `.env.example` after the GitHub section:

```
# Clerk (auth + organizations)
CLERK_PUBLISHABLE_KEY=pk_test_your-publishable-key
CLERK_SECRET_KEY=sk_test_your-secret-key
CLERK_SIGNING_SECRET=whsec_your-webhook-signing-secret
```

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/.env frontend/.env.example src/config.py .env .env.example
git commit -m "feat: install Clerk SDK and configure env vars"
```

---

### Task 2: Wrap frontend in ClerkProvider + add Landing page + protected routing

**Routing structure:**
```
/            → Landing page (public, no layout — hero, CTA, sign-up buttons)
/sign-in     → SignInPage (public) — Clerk-hosted sign-in form
/sign-up     → SignUpPage (public) — Clerk-hosted sign-up form
/dashboard   → Dashboard (protected, inside Layout with sidebar/header)
/review/:id  → Protected
/reviewers   → Protected
/docs        → Protected
/memory      → Protected
/settings    → Protected
```

**Flow:** Unauthenticated user visits `/` → sees Landing page with hero + "Get Started" → clicks → navigates to `/sign-up` or opens Clerk modal → signs up → redirected to `/dashboard`. Existing users click "Sign In" → `/sign-in` → redirected to `/dashboard`. After sign-out, Clerk redirects to `/`.

**Files:**
- Modify: `frontend/src/main.tsx`
- Create: `frontend/src/components/Landing.tsx`
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Create: `frontend/src/pages/SignIn.tsx`
- Create: `frontend/src/pages/SignUp.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Wrap app in ClerkProvider in `main.tsx`** with `afterSignInUrl="/dashboard"` and `afterSignOutUrl="/"`

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider afterSignInUrl="/dashboard" afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </StrictMode>
);
```

- [ ] **Step 2: Create `frontend/src/pages/Landing.tsx`**

A public landing page outside the app Layout. Hero section with Draftly tagline + value prop, "Get Started" button linking to `SignUpPage`, "Sign In" link to `SignInPage` for returning users, and feature highlights. No sidebar or header — full-bleed marketing page.

```typescript
import { Link } from "react-router";

export function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav bar: logo + Sign In link */}
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold">Draftly</span>
        <Link
          to="/sign-in"
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium hover:bg-gray-200"
        >
          Sign In
        </Link>
      </header>
      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight">
          Ship better code with AI-powered reviews
        </h1>
        <p className="mb-8 max-w-xl text-lg text-gray-600">
          Draftly integrates with GitHub to automate code review workflows,
          catch issues before they ship, and help your team move faster.
        </p>
        <Link
          to="/sign-up"
          className="rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700"
        >
          Get Started
        </Link>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/ProtectedRoute.tsx`**

```typescript
import { Show } from "@clerk/react";
import { Navigate } from "react-router";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <Show when="signed-in" fallback={<Navigate to="/sign-in" replace />}>
      {children}
    </Show>
  );
}
```

- [ ] **Step 4: Create `frontend/src/pages/SignIn.tsx`**

```typescript
import { SignIn } from "@clerk/react";

export function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/src/pages/SignUp.tsx`**

```typescript
import { SignUp } from "@clerk/react";

export function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  );
}
```

- [ ] **Step 6: Update `frontend/src/App.tsx`** — Landing at `/`, sign-in/sign-up public, dashboard at `/dashboard` protected

```typescript
import { BrowserRouter, Routes, Route } from "react-router";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { ReviewDetail } from "./pages/ReviewDetail";
import { Reviewers } from "./pages/Reviewers";
import { Docs } from "./pages/Docs";
import { Memory } from "./pages/Memory";
import { Settings } from "./pages/Settings";
import { SignInPage } from "./pages/SignIn";
import { SignUpPage } from "./pages/SignUp";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no Layout, no auth required */}
        <Route index element={<Landing />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        {/* Protected routes — require auth, inside Layout */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="review/:id" element={<ReviewDetail />} />
          <Route path="reviewers" element={<Reviewers />} />
          <Route path="docs" element={<Docs />} />
          <Route path="memory" element={<Memory />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 7: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/main.tsx frontend/src/pages/Landing.tsx frontend/src/components/ProtectedRoute.tsx frontend/src/pages/SignIn.tsx frontend/src/pages/SignUp.tsx frontend/src/App.tsx
git commit -m "feat: add ClerkProvider, Landing page, and protected routing"
```

---

### Task 3: Add API token management to frontend client

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/components/Header.tsx`

The `request()` function needs to attach the Clerk JWT to every API call. We use a module-level token variable set by a component that listens to Clerk auth state.

- [ ] **Step 1: Modify `frontend/src/api/client.ts`**

Add a token setter and inject the token into requests:

```typescript
const BASE_URL = "/api";

let _token: string | null = null;

export function setApiToken(token: string | null) {
  _token = token;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (_token) {
    headers["Authorization"] = `Bearer ${_token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { ...headers, ...options?.headers as Record<string, string> },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail ?? body.error ?? "Request failed");
  }
  return res.json();
}

export { request, ApiError };
```

- [ ] **Step 2: Add AuthTokenSetter component**

Create `frontend/src/components/AuthTokenSetter.tsx`:

```typescript
import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { setApiToken } from "../api/client";

export function AuthTokenSetter() {
  const { getToken } = useAuth();

  useEffect(() => {
    getToken().then((token) => setApiToken(token));
  }, [getToken]);

  return null;
}
```

- [ ] **Step 3: Add AuthTokenSetter to Layout**

Modify `frontend/src/components/Layout.tsx` to include `<AuthTokenSetter />` at the top:

```typescript
import { AuthTokenSetter } from "./AuthTokenSetter";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <AuthTokenSetter />
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add UserButton and SignInButton to Header**

Modify `frontend/src/components/Header.tsx`:

Replace the "U" avatar div (lines 86-88):

```typescript
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
              Sign In
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <UserButton afterSignOutUrl="/" />
        </Show>
```

Add the imports at the top:

```typescript
import { Show, SignInButton, UserButton } from "@clerk/react";
```

- [ ] **Step 5: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/components/AuthTokenSetter.tsx frontend/src/components/Layout.tsx frontend/src/components/Header.tsx
git commit -m "feat: add API token management and auth UI to header"
```

---

### Task 4: Add backend JWT verification dependency

**Files:**
- Create: `src/api/auth.py`

- [ ] **Step 1: Create `src/api/auth.py`**

```python
from __future__ import annotations

import structlog
from fastapi import Depends, HTTPException, Request
from jwt import PyJWKClient, PyJWTError

from src.config import settings

logger = structlog.get_logger()

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        domain = settings.clerk_publishable_key.split("_")[-1]
        jwks_url = f"https://{domain}/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
    return _jwks_client


class ClerkAuthError(HTTPException):
    def __init__(self, detail: str = "Invalid authentication"):
        super().__init__(status_code=401, detail=detail)


async def get_verified_token(request: Request) -> dict:
    """FastAPI dependency: extracts and verifies the Clerk JWT from the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise ClerkAuthError("Missing or malformed Authorization header")

    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise ClerkAuthError("Empty token")

    try:
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True},
        )
    except PyJWTError as e:
        logger.warning("jwt_verification_failed", error=str(e))
        raise ClerkAuthError("Invalid or expired token")

    user_id = payload.get("sub")
    org_id = payload.get("org_id")
    org_role = payload.get("org_role")

    if not user_id:
        raise ClerkAuthError("Token missing user identifier")

    return {
        "user_id": user_id,
        "org_id": org_id,
        "org_role": org_role,
        "raw": payload,
    }
```

- [ ] **Step 2: Verify the module imports correctly**

```bash
uv run python3 -c "from src.api.auth import get_verified_token; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/api/auth.py
git commit -m "feat: add Clerk JWT verification dependency"
```

---

### Task 5: Wire auth dependency into existing API routes

**Files:**
- Modify: `src/api/routes/reviews.py`
- Modify: `src/api/routes/reviewers.py`
- Modify: `src/api/routes/docs.py`
- Modify: `src/api/routes/memory.py`
- Modify: `src/api/routes/github.py` (GET endpoints only)

Each route needs to add the `get_verified_token` dependency and use `token["org_id"]` instead of `get_or_create_default_org()`.

- [ ] **Step 1: Update `src/api/routes/reviews.py`**

Add the dependency import and parameter to each endpoint:

```python
from src.api.auth import get_verified_token


@router.get("/pending")
async def get_pending(token: dict = Depends(get_verified_token)):
    from src.memory.reviewer import get_pending_reviews

    org_id = token.get("org_id") or "default"
    return await get_pending_reviews(org_id=org_id)


@router.post("/{review_id}/decide")
async def decide_review(
    review_id: str,
    body: ReviewDecision,
    token: dict = Depends(get_verified_token),
):
    from src.memory.reviewer import complete_review

    await complete_review(
        review_id=review_id,
        status=DECISION_TO_STATUS.get(body.decision, body.decision),
        feedback=body.feedback,
    )
    try:
        from src.agents.runners.resume import resume_review

        await resume_review(
            review_id=review_id,
            decision=body.decision,
            feedback=body.feedback or "",
        )
    except Exception as e:
        logger.error("graph_resume_failed", review_id=review_id, error=str(e))
    return {"status": "ok", "decision": body.decision, "user_id": token["user_id"]}


@router.get("/{review_id}")
async def get_review(review_id: str, token: dict = Depends(get_verified_token)):
    from src.database import fetch_one

    row = await fetch_one(
        "SELECT rs.*, rs.id::text as id, d.title, d.content, d.doc_type, d.confidence_score "
        "FROM review_sessions rs JOIN documentation d ON d.id = rs.doc_id WHERE rs.id = $1",
        review_id,
    )
    return dict(row) if row else {"error": "not found"}
```

- [ ] **Step 2: Update `src/api/routes/reviewers.py`**

Similar pattern — add `token: dict = Depends(get_verified_token)` to each endpoint and use `token["org_id"]` for org scoping.

For each endpoint, add the import at the top:

```python
from src.api.auth import get_verified_token
```

Then add `token: dict = Depends(get_verified_token)` parameter to each endpoint function.

- [ ] **Step 3: Update `src/api/routes/docs.py`**

Same pattern:

```python
from src.api.auth import get_verified_token


@router.get("/")
async def list_docs(token: dict = Depends(get_verified_token)):
    from src.memory.organizations import get_or_create_default_org
    from src.database import fetch_all

    org_id = token.get("org_id") or "default"
    rows = await fetch_all(
        "SELECT id::text, title, doc_type, version, status, confidence_score, created_at "
        "FROM documentation WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50",
        org_id,
    )
    return [dict(r) for r in rows]


@router.get("/{doc_id}")
async def get_doc(doc_id: str, token: dict = Depends(get_verified_token)):
    from src.database import fetch_one

    row = await fetch_one(
        "SELECT * FROM documentation WHERE id = $1",
        doc_id,
    )
    return dict(row) if row else {"error": "not found"}
```

- [ ] **Step 4: Update `src/api/routes/memory.py`**

```python
from src.api.auth import get_verified_token


@router.get("/stats")
async def memory_stats(token: dict = Depends(get_verified_token)):
    # Stats are global, but eventually could be org-scoped
    from src.database import fetch_all

    rows = await fetch_all(
        "SELECT 'support_threads' as name, COUNT(*)::int as count FROM support_threads "
        "UNION ALL SELECT 'documentation', COUNT(*)::int FROM documentation "
        "UNION ALL SELECT 'embeddings', COUNT(*)::int FROM embeddings "
        "UNION ALL SELECT 'review_sessions', COUNT(*)::int FROM review_sessions "
        "UNION ALL SELECT 'agent_memory', COUNT(*)::int FROM agent_memory "
        "UNION ALL SELECT 'audit_logs', COUNT(*)::int FROM audit_logs"
    )
    return {row["name"]: row["count"] for row in rows}


@router.get("/search")
async def memory_search(
    q: str = "",
    type: str = "all",
    token: dict = Depends(get_verified_token),
):
    if not q:
        return []
    from src.memory.vector_store import search_memory

    org_id = token.get("org_id")
    return await search_memory(query=q, content_type=type, org_id=org_id)
```

- [ ] **Step 5: Update `src/api/routes/github.py` GET endpoints**

Add auth to the install-url and installations endpoints (NOT the webhook):

```python
from src.api.auth import get_verified_token


@router.get("/install-url")
async def github_install_url(token: dict = Depends(get_verified_token)):
    if not settings.github_app_slug:
        raise HTTPException(status_code=500, detail="GitHub App slug not configured")
    return {"install_url": f"https://github.com/apps/{settings.github_app_slug}/installations/new"}


@router.get("/installations")
async def github_installations(token: dict = Depends(get_verified_token)):
    from src.memory.organizations import list_github_installations

    return await list_github_installations()
```

- [ ] **Step 6: Run existing tests to verify no regression**

```bash
uv run pytest tests/test_github_webhook.py tests/test_github_app.py -v
```

Expected: all tests pass (webhook is not affected by auth changes).

- [ ] **Step 7: Commit**

```bash
git add src/api/routes/reviews.py src/api/routes/reviewers.py src/api/routes/docs.py src/api/routes/memory.py src/api/routes/github.py
git commit -m "feat: wire Clerk auth dependency into API routes"
```

---

### Task 6: Create DB schema for Clerk users and organizations

**Files:**
- Create: `src/memory/users.py`
- Modify: `src/memory/organizations.py`

- [ ] **Step 1: Create `src/memory/users.py`**

```python
from __future__ import annotations

import structlog

from src.database import execute, fetch_all, fetch_one

logger = structlog.get_logger()


async def create_clerk_user(clerk_user_id: str, email: str, name: str, avatar_url: str = "") -> str:
    """Create a new user record from Clerk webhook data."""
    existing = await fetch_one(
        "SELECT id::text FROM clerk_users WHERE clerk_user_id = $1",
        clerk_user_id,
    )
    if existing:
        await execute(
            "UPDATE clerk_users SET email = $1, name = $2, avatar_url = $3, updated_at = now() "
            "WHERE clerk_user_id = $4",
            email, name, avatar_url, clerk_user_id,
        )
        return existing["id"]

    row = await fetch_one(
        "INSERT INTO clerk_users (clerk_user_id, email, name, avatar_url) "
        "VALUES ($1, $2, $3, $4) RETURNING id::text",
        clerk_user_id, email, name, avatar_url,
    )
    logger.info("clerk_user_created", user_id=clerk_user_id)
    return row["id"]


async def delete_clerk_user(clerk_user_id: str) -> None:
    """Remove a user from the local DB (soft-delete or remove memberships first)."""
    await execute(
        "DELETE FROM user_organizations WHERE user_id = (SELECT id FROM clerk_users WHERE clerk_user_id = $1)",
        clerk_user_id,
    )
    await execute("DELETE FROM clerk_users WHERE clerk_user_id = $1", clerk_user_id)
    logger.info("clerk_user_deleted", user_id=clerk_user_id)


async def add_user_to_org(clerk_user_id: str, clerk_org_id: str, role: str = "org:member") -> str:
    """Link a user to an organization with a role."""
    row = await fetch_one(
        "INSERT INTO user_organizations (user_id, org_id, role) "
        "VALUES ("
        "  (SELECT id FROM clerk_users WHERE clerk_user_id = $1),"
        "  (SELECT id FROM organizations WHERE clerk_org_id = $2),"
        "  $3"
        ") ON CONFLICT (user_id, org_id) DO UPDATE SET role = $3 "
        "RETURNING id::text",
        clerk_user_id, clerk_org_id, role,
    )
    logger.info("user_added_to_org", user=clerk_user_id, org=clerk_org_id, role=role)
    return row["id"]


async def remove_user_from_org(clerk_user_id: str, clerk_org_id: str) -> None:
    """Remove a user from an organization."""
    await execute(
        "DELETE FROM user_organizations "
        "WHERE user_id = (SELECT id FROM clerk_users WHERE clerk_user_id = $1) "
        "AND org_id = (SELECT id FROM organizations WHERE clerk_org_id = $2)",
        clerk_user_id, clerk_org_id,
    )
    logger.info("user_removed_from_org", user=clerk_user_id, org=clerk_org_id)


async def get_org_by_clerk_id(clerk_org_id: str) -> dict | None:
    """Look up an organization by its Clerk ID."""
    row = await fetch_one(
        "SELECT id::text, name, clerk_org_id FROM organizations WHERE clerk_org_id = $1",
        clerk_org_id,
    )
    return dict(row) if row else None
```

- [ ] **Step 2: Add `clerk_org_id` to organizations table + create new tables**

Run this SQL against CockroachDB:

```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS clerk_org_id STRING;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_clerk_org_id ON organizations (clerk_org_id);

CREATE TABLE IF NOT EXISTS clerk_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id STRING NOT NULL UNIQUE,
    email STRING NOT NULL,
    name STRING NOT NULL,
    avatar_url STRING DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES clerk_users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role STRING NOT NULL DEFAULT 'org:member',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, org_id)
);
```

- [ ] **Step 3: Update `src/memory/organizations.py` to add clerk-friendly function**

Add to the existing file:

```python
async def get_or_create_org_by_clerk(clerk_org_id: str, name: str) -> str:
    """Get or create an organization from a Clerk organization webhook."""
    # Try by clerk_org_id
    existing = await fetch_one(
        "SELECT id::text FROM organizations WHERE clerk_org_id = $1",
        clerk_org_id,
    )
    if existing:
        return existing["id"]

    # Try by name, then set clerk_org_id
    existing = await fetch_one(
        "SELECT id::text FROM organizations WHERE name = $1",
        name,
    )
    if existing:
        await fetch_one(
            "UPDATE organizations SET clerk_org_id = $1 WHERE id = $2::uuid",
            clerk_org_id,
            existing["id"],
        )
        return existing["id"]

    # Create new org
    row = await fetch_one(
        "INSERT INTO organizations (name, clerk_org_id) VALUES ($1, $2) RETURNING id::text",
        name,
        clerk_org_id,
    )
    logger.info("org_created_from_clerk", name=name, clerk_org_id=clerk_org_id, id=row["id"])
    return row["id"]
```

- [ ] **Step 4: Commit**

```bash
git add src/memory/users.py src/memory/organizations.py
git commit -m "feat: add clerk_users and user_organizations schema with sync functions"
```

---

### Task 7: Add Clerk webhook handler for user/org sync

**Files:**
- Create: `src/api/routes/clerk.py`
- Modify: `src/api/app.py`

- [ ] **Step 1: Create `src/api/routes/clerk.py`**

```python
from __future__ import annotations

import base64
import hashlib
import hmac

import structlog
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.config import settings
from src.memory.organizations import get_or_create_org_by_clerk
from src.memory.users import (
    add_user_to_org,
    create_clerk_user,
    delete_clerk_user,
    get_org_by_clerk_id,
    remove_user_from_org,
)

logger = structlog.get_logger()

router = APIRouter()


class WebhookResponse(BaseModel):
    status: str


def verify_svix_signature(payload: bytes, headers: dict[str, str]) -> bool:
    """Verify Svix webhook signature (used by Clerk)."""
    svix_id = headers.get("svix-id")
    svix_timestamp = headers.get("svix-timestamp")
    svix_signature = headers.get("svix-signature")

    if not all([svix_id, svix_timestamp, svix_signature]):
        return False

    secret = settings.clerk_signing_secret.get_secret_value()
    to_sign = f"{svix_id}.{svix_timestamp}.{payload.decode()}"
    expected = hmac.new(secret.encode(), to_sign.encode(), hashlib.sha256).digest()
    expected_b64 = base64.b64encode(expected).decode()

    for sig in svix_signature.split(" "):
        if sig.startswith("v1,"):
            received = sig[3:]
            if hmac.compare_digest(received, expected_b64):
                return True
    return False


@router.post("/webhook")
async def clerk_webhook(request: Request) -> WebhookResponse:
    """Receive Clerk webhook events for user and organization lifecycle."""
    body = await request.body()
    headers = dict(request.headers)

    if not verify_svix_signature(body, headers):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json

    payload = json.loads(body)
    event_type = payload.get("type", "")
    data = payload.get("data", {})

    logger.info("clerk_webhook_received", event_type=event_type)

    # ── User events ──
    if event_type == "user.created":
        await create_clerk_user(
            clerk_user_id=data["id"],
            email=data.get("email_addresses", [{}])[0].get("email_address", ""),
            name=f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or "Unknown",
            avatar_url=data.get("profile_image_url", ""),
        )

    elif event_type == "user.deleted":
        await delete_clerk_user(data["id"])

    elif event_type == "user.updated":
        await create_clerk_user(  # upsert (same function handles update)
            clerk_user_id=data["id"],
            email=data.get("email_addresses", [{}])[0].get("email_address", ""),
            name=f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or "Unknown",
            avatar_url=data.get("profile_image_url", ""),
        )

    # ── Organization events ──
    elif event_type == "organization.created":
        await get_or_create_org_by_clerk(
            clerk_org_id=data["id"],
            name=data.get("name", "Unnamed Organization"),
        )

    elif event_type == "organization.deleted":
        # Clean up local org data
        org = await get_org_by_clerk_id(data["id"])
        if org:
            from src.database import execute as db_execute
            await db_execute("DELETE FROM organizations WHERE id = $1::uuid", org["id"])
            logger.info("org_deleted_from_clerk", org_id=org["id"])

    elif event_type == "organization.updated":
        org = await get_org_by_clerk_id(data["id"])
        if org:
            from src.database import execute as db_execute
            await db_execute(
                "UPDATE organizations SET name = $1 WHERE id = $2::uuid",
                data.get("name", org["name"]),
                org["id"],
            )

    # ── Membership events ──
    elif event_type == "organizationMembership.created":
        await add_user_to_org(
            clerk_user_id=data["public_user_data"]["user_id"],
            clerk_org_id=data["organization"]["id"],
            role=data.get("role", "org:member"),
        )

    elif event_type == "organizationMembership.deleted":
        await remove_user_from_org(
            clerk_user_id=data["public_user_data"]["user_id"],
            clerk_org_id=data["organization"]["id"],
        )

    elif event_type == "organizationMembership.updated":
        await add_user_to_org(  # upsert with new role
            clerk_user_id=data["public_user_data"]["user_id"],
            clerk_org_id=data["organization"]["id"],
            role=data.get("role", "org:member"),
        )

    return WebhookResponse(status="ok")
```

- [ ] **Step 2: Register the router in `src/api/app.py`**

Add import:

```python
from src.api.routes import clerk as clerk_router
```

Add registration:

```python
app.include_router(clerk_router.router, prefix="/api/clerk", tags=["clerk"])
```

- [ ] **Step 3: Run existing tests to verify no regression**

```bash
uv run pytest tests/test_github_webhook.py tests/test_github_app.py -v
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/clerk.py src/api/app.py
git commit -m "feat: add Clerk webhook handler for user/org/membership sync"
```

---

### Task 8: Add OrganizationSwitcher and org-aware UI

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/components/Header.tsx`

- [ ] **Step 1: Update `frontend/src/pages/Settings.tsx` to add OrganizationSwitcher**

Add a new section at the top of the settings page, above the GitHub section:

```typescript
import { OrganizationSwitcher, useOrganization } from "@clerk/react";

// Inside the component, add before the GitHub section:
export function Settings() {
  const { organization, membership } = useOrganization();
  // ... existing state ...

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Organization section */}
      <section className="rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Organization</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage your team and organization settings.
        </p>
        <div className="mt-4">
          <OrganizationSwitcher />
        </div>
        {organization && (
          <div className="mt-4 text-sm text-gray-600">
            <p>
              Active: <strong>{organization.name}</strong>
              {membership && (
                <span> — Role: <strong>{membership.role}</strong></span>
              )}
            </p>
          </div>
        )}
      </section>

      {/* GitHub Integration section */}
      ...
    </div>
  );
}
```

- [ ] **Step 2: Update `frontend/src/components/Header.tsx` to show org name**

Replace the static "default" badge with the active org name from Clerk:

```typescript
import { useOrganization, useAuth } from "@clerk/react";

export function Header() {
  const location = useLocation();
  const crumbs = getBreadcrumb(location.pathname);
  const { organization } = useOrganization();
  const { isSignedIn } = useAuth();
  // ...

  {/* Right: Org name + actions */}
  <div className="flex items-center gap-3">
    {isSignedIn && (
      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        {organization?.name || "No Org"}
      </span>
    )}
    {/* ... settings link and UserButton ... */}
  </div>
}
```

- [ ] **Step 3: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Settings.tsx frontend/src/components/Header.tsx
git commit -m "feat: add OrganizationSwitcher and org-aware header"
```

---

### Task 9: Add role-based access control for admin actions

**Files:**
- Modify: `src/api/auth.py`
- Modify: `src/api/routes/reviewers.py`

- [ ] **Step 1: Add role-checking dependency to `src/api/auth.py`**

Add at the end of `src/api/auth.py`:

```python
async def require_admin_role(token: dict = Depends(get_verified_token)) -> dict:
    """Require the user to have admin role in the current organization."""
    if token.get("org_role") not in ("org:admin",):
        raise HTTPException(
            status_code=403,
            detail="Admin role required for this action",
        )
    return token
```

- [ ] **Step 2: Protect admin-only endpoints in `src/api/routes/reviewers.py`**

Change the CREATE, UPDATE, and DELETE endpoints to use `require_admin_role`:

```python
from src.api.auth import get_verified_token, require_admin_role


@router.post("/")
async def create_reviewer(
    body: CreateReviewerPayload,
    token: dict = Depends(require_admin_role),
):
    # ... existing implementation with token["org_id"] ...


@router.put("/{reviewer_id}")
async def update_reviewer(
    reviewer_id: str,
    body: UpdateReviewerPayload,
    token: dict = Depends(require_admin_role),
):
    # ...


@router.delete("/{reviewer_id}")
async def delete_reviewer(
    reviewer_id: str,
    token: dict = Depends(require_admin_role),
):
    # ...
```

- [ ] **Step 3: Verify frontend compiles and tests pass**

```bash
cd frontend && npx tsc --noEmit
uv run pytest tests/test_github_webhook.py tests/test_github_app.py -v
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/api/auth.py src/api/routes/reviewers.py
git commit -m "feat: add role-based access control for admin endpoints"
```
