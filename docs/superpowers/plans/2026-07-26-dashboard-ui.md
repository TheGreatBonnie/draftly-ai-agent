# Implementation Plan: Dashboard UI Enhancement

**Date:** 2026-07-26
**Spec:** `docs/superpowers/specs/2026-07-26-dashboard-ui-design.md`
**Status:** Ready to execute

## Steps

### Step 1: Backend — Add GET /api/reviews endpoint

Create a new route in `src/api/routes/reviews.py` that returns all reviews for the current org (not just pending). Order by `created_at DESC`.

Update `frontend/src/api/reviews.ts` with `getAllReviews()`.

### Step 2: Badge — Title-case labels

Update `Badge.tsx` to render status labels as "Needs Changes" instead of "needs_changes". Use a label map instead of `.replace("_", " ")`.

### Step 3: StatsCard component

Create `src/components/StatsCard.tsx`:
- Props: `label: string`, `value: string | number`, `color?: string`
- Renders: label text (small, muted) + value (large, bold, optional color)

### Step 4: FilterTabs component

Create `src/components/FilterTabs.tsx`:
- Props: `tabs: { key: string; label: string; count: number }[]`, `active: string`, `onChange: (key: string) => void`
- Renders: row of tab buttons with active state styling

### Step 5: EmptyState component

Create `src/components/EmptyState.tsx`:
- Props: `icon?: string`, `title: string`, `description?: string`
- Renders: centered icon + title + description

### Step 6: ReviewCard — Rich card with quick actions

Rewrite `src/components/ReviewCard.tsx`:
- Doc type badge + relative time in header
- Document title (bold)
- Content preview snippet (truncated to ~120 chars)
- Status badge + confidence bar (right side)
- Action bar: Approve/Review/Reject for pending, View Document for others
- Quick approve calls `decideReview()` and triggers a refresh callback

### Step 7: Dashboard — Full rewrite

Rewrite `src/pages/Dashboard.tsx`:
- Fetch all reviews on mount via `getAllReviews()`
- Compute stats (pending count, approved count, this week count, avg confidence)
- State: `activeTab`, `searchQuery`, `sortBy`
- Client-side filter by tab, search by title, sort by selected option
- Render: title + subtitle, stats row, filter tabs, search + sort, card list or empty state
- Loading skeleton, error state with retry

### Step 8: Verify

- `npx tsc --noEmit`
- `npx eslint src/ --max-warnings=0` (check for new errors only)
- `npx vite build`

## File Summary

| Action | File |
|--------|------|
| Modify | `src/api/reviews.ts` (add `getAllReviews`) |
| Modify | `src/api/routes/reviews.py` (add GET / endpoint) |
| Modify | `src/components/Badge.tsx` (title-case labels) |
| Create | `src/components/StatsCard.tsx` |
| Create | `src/components/FilterTabs.tsx` |
| Create | `src/components/EmptyState.tsx` |
| Rewrite | `src/components/ReviewCard.tsx` |
| Rewrite | `src/pages/Dashboard.tsx` |
