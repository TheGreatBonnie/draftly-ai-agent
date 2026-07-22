# Reviewer Self-Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable reviewers to edit their own profile (notification preferences, Slack/Discord IDs) while allowing admins to edit any reviewer's full profile.

**Architecture:** Modify the existing `PUT /api/reviewers/{id}` backend endpoint to support role-based authorization (admin vs reviewer self-edit). Add edit UI components to the frontend `Reviewers.tsx` page with conditional field visibility based on user role.

**Tech Stack:** FastAPI, Pydantic, CockroachDB, React 19, TypeScript, TailwindCSS, Clerk JWT auth

---

## File Structure

| File | Change Type | Purpose |
|------|-------------|---------|
| `src/api/routes/reviewers.py:165-181` | Modify | Add role-based authorization to PUT endpoint |
| `frontend/src/pages/Reviewers.tsx:1-13` | Modify | Add `updateReviewer` and `UpdateReviewerPayload` imports |
| `frontend/src/pages/Reviewers.tsx:43-56` | Modify | Add `editForm` and `editingId` state |
| `frontend/src/pages/Reviewers.tsx` (new handlers) | Modify | Add `handleUpdate()` and `updateEditField()` functions |
| `frontend/src/pages/Reviewers.tsx:329-383` | Modify | Add Edit buttons to reviewer cards |
| `frontend/src/pages/Reviewers.tsx` (new section) | Modify | Add edit form component |

---

## Task 1: Backend - Modify PUT Endpoint for Role-Based Authorization

**Files:**
- Modify: `src/api/routes/reviewers.py:165-181`

- [ ] **Step 1: Read the current PUT endpoint**

Read lines 165-181 of `src/api/routes/reviewers.py` to understand the current implementation:

```python
@router.put("/{reviewer_id}")
async def update(
    reviewer_id: str,
    request: UpdateReviewerRequest,
    token: dict = Depends(require_admin_role),
):
    """Update a reviewer (admin only)."""
    existing = await get_reviewer_by_id(reviewer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    updates = request.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = await update_reviewer(reviewer_id, **updates)
    return updated
```

- [ ] **Step 2: Modify the PUT endpoint with role-based authorization**

Replace the `update` function in `src/api/routes/reviewers.py:165-181` with:

```python
@router.put("/{reviewer_id}")
async def update(
    reviewer_id: str,
    request: UpdateReviewerRequest,
    token: dict = Depends(get_verified_token),
):
    """Update a reviewer (admin: any reviewer; reviewer: own profile only)."""
    existing = await get_reviewer_by_id(reviewer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    # Check authorization
    is_admin = token.get("org_role") == "admin"
    is_self = existing.get("clerk_user_id") == token.get("user_id")

    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Can only edit your own profile")

    updates = request.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # If reviewer (not admin), restrict to allowed fields only
    if not is_admin:
        allowed_for_reviewer = {
            "slack_user_id", "discord_user_id",
            "notify_slack", "notify_discord", "notify_email",
        }
        updates = {k: v for k, v in updates.items() if k in allowed_for_reviewer}
        if not updates:
            raise HTTPException(
                status_code=400,
                detail="Reviewers can only update notification preferences and platform IDs",
            )

    updated = await update_reviewer(reviewer_id, **updates)
    return updated
```

- [ ] **Step 3: Update the import statement**

Verify that `get_verified_token` is already imported in `src/api/routes/reviewers.py:6`:

```python
from src.api.auth import get_verified_token, require_admin_role, require_reviewer_role
```

If not already present, add `get_verified_token` to the import.

- [ ] **Step 4: Run linting**

Run: `uv run ruff check src/api/routes/reviewers.py`
Expected: No errors

- [ ] **Step 5: Run type checking**

Run: `uv run mypy src/api/routes/reviewers.py`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/reviewers.py
git commit -m "feat: allow reviewers to edit their own profile via PUT endpoint"
```

---

## Task 2: Frontend - Add Imports and State

**Files:**
- Modify: `frontend/src/pages/Reviewers.tsx:1-13`
- Modify: `frontend/src/pages/Reviewers.tsx:43-56`

- [ ] **Step 1: Update imports**

Replace lines 1-13 of `frontend/src/pages/Reviewers.tsx` with:

```typescript
import { useEffect, useState } from "react";
import { useAuth, useOrganization } from "@clerk/react";
import {
  listReviewers,
  createReviewer,
  updateReviewer,
  deleteReviewer,
  registerSelf,
} from "../api/reviewers";
import type {
  Reviewer,
  CreateReviewerPayload,
  UpdateReviewerPayload,
  SelfRegisterPayload,
} from "../api/types";
```

- [ ] **Step 2: Add edit form state**

After line 56 (after `const [selfRegistering, setSelfRegistering] = useState(false);`), add:

```typescript
const [editForm, setEditForm] = useState<UpdateReviewerPayload>({});
const [editingId, setEditingId] = useState<string | null>(null);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Reviewers.tsx
git commit -m "feat: add edit form imports and state to Reviewers component"
```

---

## Task 3: Frontend - Add Update Handlers

**Files:**
- Modify: `frontend/src/pages/Reviewers.tsx` (after line 105)

- [ ] **Step 1: Add handleUpdate function**

After the `handleDelete` function (after line 105), add:

```typescript
async function handleUpdate() {
  if (!editingId) return;
  try {
    await updateReviewer(editingId, editForm);
    setEditingId(null);
    setEditForm({});
    load();
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : "Update failed");
  }
}
```

- [ ] **Step 2: Add updateEditField helper**

After the `handleUpdate` function, add:

```typescript
function updateEditField<K extends keyof UpdateReviewerPayload>(
  key: K,
  value: UpdateReviewerPayload[K],
) {
  setEditForm((prev) => ({ ...prev, [key]: value }));
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Reviewers.tsx
git commit -m "feat: add update handlers for reviewer edit form"
```

---

## Task 4: Frontend - Add Edit Buttons to Reviewer Cards

**Files:**
- Modify: `frontend/src/pages/Reviewers.tsx:356-380`

- [ ] **Step 1: Add Edit buttons**

Replace lines 372-379 of `frontend/src/pages/Reviewers.tsx` with:

```tsx
{isAdmin && (
  <button
    onClick={() => {
      setEditingId(r.id);
      setEditForm({
        name: r.name,
        email: r.email ?? "",
        slack_user_id: r.slack_user_id ?? "",
        discord_user_id: r.discord_user_id ?? "",
        notify_slack: r.notify_slack,
        notify_discord: r.notify_discord,
        notify_email: r.notify_email,
      });
    }}
    className="text-blue-500 hover:text-blue-700"
  >
    Edit
  </button>
)}
{isReviewerRole && r.clerk_user_id === userId && (
  <button
    onClick={() => {
      setEditingId(r.id);
      setEditForm({
        slack_user_id: r.slack_user_id ?? "",
        discord_user_id: r.discord_user_id ?? "",
        notify_slack: r.notify_slack,
        notify_discord: r.notify_discord,
        notify_email: r.notify_email,
      });
    }}
    className="text-blue-500 hover:text-blue-700"
  >
    Edit Profile
  </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Reviewers.tsx
git commit -m "feat: add edit buttons to reviewer cards"
```

---

## Task 5: Frontend - Add Edit Form Component

**Files:**
- Modify: `frontend/src/pages/Reviewers.tsx` (after line 323, before the reviewer list)

- [ ] **Step 1: Add edit form**

After line 323 (after the closing `</div>` of the admin form), add:

```tsx
{editingId && (
  <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
    <h2 className="mb-3 font-semibold text-yellow-900">Edit Reviewer</h2>

    {/* Admin-only fields */}
    {isAdmin && (
      <div className="grid grid-cols-2 gap-3">
        <input
          className={inputClass}
          placeholder="Name *"
          value={editForm.name ?? ""}
          onChange={(e) => updateEditField("name", e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Email"
          value={editForm.email ?? ""}
          onChange={(e) => updateEditField("email", e.target.value)}
        />
      </div>
    )}

    {/* Read-only fields for reviewers editing their own profile */}
    {isReviewerRole && !isAdmin && (
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-yellow-700">Name</label>
          <input
            className={`${inputClass} bg-gray-100`}
            value={
              reviewers.find((r) => r.id === editingId)?.name ?? ""
            }
            disabled
            readOnly
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-yellow-700">Email</label>
          <input
            className={`${inputClass} bg-gray-100`}
            value={
              reviewers.find((r) => r.id === editingId)?.email ?? ""
            }
            disabled
            readOnly
          />
        </div>
      </div>
    )}

    {/* Platform IDs (both admin and reviewer can edit) */}
    <div className={`${isAdmin ? "mt-3 grid grid-cols-2 gap-3" : "mt-3 grid grid-cols-2 gap-3"}`}>
      <input
        className={inputClass}
        placeholder="Slack User ID"
        value={editForm.slack_user_id ?? ""}
        onChange={(e) => updateEditField("slack_user_id", e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="Discord User ID"
        value={editForm.discord_user_id ?? ""}
        onChange={(e) => updateEditField("discord_user_id", e.target.value)}
      />
    </div>

    {/* Notification preferences */}
    <div className="mt-3 flex gap-4">
      <label className="flex items-center gap-2 text-sm text-yellow-800">
        <input
          type="checkbox"
          checked={editForm.notify_slack ?? true}
          onChange={(e) => updateEditField("notify_slack", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        Notify via Slack
      </label>
      <label className="flex items-center gap-2 text-sm text-yellow-800">
        <input
          type="checkbox"
          checked={editForm.notify_discord ?? false}
          onChange={(e) => updateEditField("notify_discord", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        Notify via Discord
      </label>
      <label className="flex items-center gap-2 text-sm text-yellow-800">
        <input
          type="checkbox"
          checked={editForm.notify_email ?? false}
          onChange={(e) => updateEditField("notify_email", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        Notify via Email
      </label>
    </div>

    {/* Action buttons */}
    <div className="mt-4 flex justify-end gap-2">
      <button
        onClick={() => {
          setEditingId(null);
          setEditForm({});
        }}
        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
        onClick={handleUpdate}
        disabled={isAdmin && !editForm.name?.trim()}
        className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
      >
        Save Changes
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Reviewers.tsx
git commit -m "feat: add edit form component with role-based field visibility"
```

---

## Task 6: Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run backend linting**

Run: `uv run ruff check src/`
Expected: No errors

- [ ] **Step 2: Run backend type checking**

Run: `uv run mypy src/`
Expected: No errors

- [ ] **Step 3: Run backend tests**

Run: `uv run pytest`
Expected: All tests pass

- [ ] **Step 4: Run frontend linting**

Run: `cd frontend && npm run lint`
Expected: No errors

- [ ] **Step 5: Run frontend type checking**

Run: `cd frontend && npm run typecheck`
Expected: No errors

- [ ] **Step 6: Manual testing**

1. Start backend: `uv run uvicorn src.api.app:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Test scenarios:
   - Admin can edit any reviewer (all fields editable)
   - Reviewer can edit own profile (only notification prefs and platform IDs)
   - Reviewer cannot edit other reviewers (no Edit button visible)
   - Read-only name/email shown for reviewer self-edit

---

## Permission Matrix

| Field | Admin (any reviewer) | Reviewer (own profile) |
|-------|---------------------|------------------------|
| name | ✅ Editable | 🔒 Read-only |
| email | ✅ Editable | 🔒 Read-only |
| slack_user_id | ✅ Editable | ✅ Editable |
| discord_user_id | ✅ Editable | ✅ Editable |
| notify_slack | ✅ Editable | ✅ Editable |
| notify_discord | ✅ Editable | ✅ Editable |
| notify_email | ✅ Editable | ✅ Editable |

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Backend: Add role-based authorization to PUT endpoint | `src/api/routes/reviewers.py` |
| 2 | Frontend: Add imports and state | `frontend/src/pages/Reviewers.tsx` |
| 3 | Frontend: Add update handlers | `frontend/src/pages/Reviewers.tsx` |
| 4 | Frontend: Add edit buttons to reviewer cards | `frontend/src/pages/Reviewers.tsx` |
| 5 | Frontend: Add edit form component | `frontend/src/pages/Reviewers.tsx` |
| 6 | Verification | None |

---

## Self-Review Checklist

- [x] **Spec coverage:** All requirements implemented (admin edit, reviewer self-edit, read-only fields)
- [x] **Placeholder scan:** No TBDs, TODOs, or vague steps
- [x] **Type consistency:** `UpdateReviewerPayload` used consistently across all tasks
- [x] **File paths:** All paths are exact and match existing codebase
- [x] **Code blocks:** All code steps include complete, copy-pasteable code
- [x] **Commands:** All commands include exact syntax and expected output
