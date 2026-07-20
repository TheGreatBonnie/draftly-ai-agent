# Clerk Auth + Organizations Design

> **Status:** Spec v1
> **Goal:** Add user authentication, multi-tenant organization management, and role-based access control to Draftly using Clerk.

## Architecture

```
Frontend (React 19 + Vite)            Backend (FastAPI)
┌────────────────────────────┐        ┌──────────────────────────────┐
│  @clerk/react SDK          │  JWT   │  src/api/auth.py             │
│  ─ ClerkProvider (main)    │ ─────> │  ─ PyJWKClient verify        │
│  ─ UserButton (header)     │ Bearer │  ─ extract sub/org_id/role   │
│  ─ OrgSwitcher (settings)  │ token  │  ─ Depends() per route       │
│  ─ useAuth().getToken()    │        │                              │
│  ─ useOrganization()       │        │  Clerk Webhook ─────────────┐│
│                             │        │  POST /api/clerk/webhook   ││
│  ProtectedRoute wrapper    │        │  ─ Svix signature verify    ││
│  ─ redirect if signed-out  │        │  ─ user.created/deleted     ││
│  ─ org_id in API calls     │        │  ─ org.created/deleted      ││
└────────────────────────────┘        │  ─ membership.created       ││
                                      │  ─ sync to CockroachDB      ││
                                      └──────────────────────────────┘
```

**Data flow:**

1. User signs in via Clerk (hosted UI or social login)
2. Clerk issues a JWT containing `sub` (user ID), `org_id` (active org), `org_role`
3. Frontend attaches the JWT as `Authorization: Bearer <token>` on every API call via `useAuth().getToken()`
4. Backend verifies the JWT using Clerk's JWKS endpoint, extracts claims
5. Backend uses `org_id` from the JWT to scope all database queries (replaces `get_or_create_default_org()`)
6. Clerk webhooks keep Draftly's database in sync with Clerk's user/org/membership state

## Frontend Changes

### main.tsx
- Wrap `<App />` in `<ClerkProvider>` (no manual publishableKey prop — reads from `VITE_CLERK_PUBLISHABLE_KEY` env var)

### api/client.ts
- Change `request()` to accept an optional `token` parameter
- New helper: `ApiClient` class that stores token and injects it automatically

### api/hooks.ts (new)
- `useApi<T>(fn: (token: string) => Promise<T>)` — wraps API calls with automatic token injection from `useAuth().getToken()`

### components/ProtectedRoute.tsx (new)
- Wraps routes requiring auth
- Uses `<Show when="signed-in">` with `<Navigate to="/sign-in">` fallback

### components/Header.tsx
- Replace "U" avatar with `<UserButton afterSignOutUrl="/" />`
- Add `<SignInButton />` in signed-out state via `<Show when="signed-out">`
- Add `<OrganizationSwitcher />` next to the org badge

### App.tsx
- Add `/sign-in/*` route using Clerk's `<SignIn />` component
- Wrap existing routes in `<ProtectedRoute>`

### pages/Settings.tsx
- Add `<OrganizationSwitcher />` for org management
- Show current org name, members, invite flow

## Backend Changes

### src/api/auth.py (new)
- `get_verified_token(request)` — FastAPI dependency
- Fetches Clerk JWKS from `https://{CLERK_FRONTEND_API}/.well-known/jwks.json`
- Verifies JWT signature, expiry, issuer
- Returns dict with `sub`, `org_id`, `org_role`
- Caches JWKS keys (they rotate infrequently)

### src/config.py
- Add `clerk_publishable_key: str`, `clerk_secret_key: SecretStr`, `clerk_jwks_url: str`, `clerk_signing_secret: SecretStr`
- Add `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_SIGNING_SECRET` to env

### Route files (reviews.py, reviewers.py, docs.py, memory.py)
- Add `token: dict = Depends(get_verified_token)` parameter
- Replace `get_or_create_default_org()` with `token["org_id"]` based org lookup
- Routes that are already org-scoped (reviews, reviewers, docs, memory)

### src/api/routes/clerk.py (new)
- `POST /api/clerk/webhook` — receives Clerk webhooks
- Verifies Svix webhook signature
- Handles `user.created/deleted`, `organization.created/deleted`, `organizationMembership.created/deleted`
- Syncs to CockroachDB tables

### src/memory/organizations.py
- `get_or_create_org_by_clerk(clerk_org_id: str, name: str)` — creates/finds org from Clerk webhook
- `store_clerk_user(clerk_user_id: str, email: str, name: str)` — stores user records

### src/memory/users.py (new)
- User CRUD: `get_user`, `create_user`, `list_users_by_org`
- `user_organizations` table linking users to orgs with roles

## Data Model

No changes to existing Draftly tables (`organizations`, `reviewers`, `docs`, etc.) — they already have `org_id`.

### New tables:

```sql
CREATE TABLE clerk_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id STRING NOT NULL UNIQUE,
    email STRING NOT NULL,
    name STRING NOT NULL,
    avatar_url STRING,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES clerk_users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role STRING NOT NULL DEFAULT 'org:member',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, org_id)
);
```

### organizations table addition:
- Add `clerk_org_id STRING` column to the existing `organizations` table (nullable, unique)

## Route Protection Matrix

| Route | Auth Required | Org Scoped | Notes |
|-------|--------------|------------|-------|
| `GET /api/reviews/*` | Yes | Yes | Reviews for active org |
| `POST /api/reviews/*/decide` | Yes | Yes | Record who decided |
| `GET /api/reviewers/*` | Yes | Yes | Org's reviewers |
| `POST /api/reviewers` | Yes | Yes | Users with `org:admin` |
| `GET /api/docs/*` | Yes | Yes | Org's docs |
| `GET /api/memory/*` | Yes | Yes | Org's memory |
| `POST /api/github/webhook` | No | No | HMAC-verified |
| `POST /api/slack/interactivity` | No | No | HMAC-verified |
| `POST /api/clerk/webhook` | No | No | Svix-verified |
| `GET /api/github/*` | Yes | Yes | Org's installations |

## Implementation Phases

### Phase 1: Auth foundation (Tasks 1-4)
1. Install Clerk SDK, configure env vars
2. Wrap frontend in ClerkProvider, add ProtectedRoute
3. Add backend JWT verification (src/api/auth.py)
4. Wire auth dependency into existing routes

### Phase 2: Organizations (Tasks 5-7)
5. Add Clerk webhook handler for user/org sync
6. Create clerk_users + user_organizations tables
7. Update organizations table with clerk_org_id

### Phase 3: RBAC + UI (Tasks 8-9)
8. Add OrganizationSwitcher to settings page
9. Role-based route protection (admin vs member)

## Security

- Clerk webhooks verified via Svix HMAC signatures
- GitHub/Slack webhooks continue using HMAC (unchanged)
- JWT verification caches JWKS keys (TTL: 1 hour)
- All auth errors return 401, never leak user data
- CORS not needed (frontend served from same origin via SPA catch-all)
