# Design Spec: Dashboard UI Enhancement

**Date:** 2026-07-26
**Status:** Approved
**Author:** opencode

## Problem

The current dashboard is minimal: it fetches pending reviews on mount, displays them as a flat list with title/doc-type/date/badge/confidence-bar, and has a single "Review" link. There is no filtering, sorting, search, stats overview, content preview, or quick actions. Loading/error states are plain text with no retry.

## Solution

Enhance the dashboard to show all reviews (not just pending) with a stats overview, filterable tabs, search, sort, rich content previews, and quick action buttons. Apply the warm & approachable theme tokens consistently.

## Design Decisions

### All reviews, not just pending

The dashboard shows all reviews across all statuses (pending, approved, rejected, needs_changes) with filter tabs to switch between them. This gives users a complete picture of their review pipeline.

### Quick actions on cards

Pending cards show Approve / Review / Reject buttons directly. Approved/rejected cards show a "View Document" link. This reduces navigation friction for the most common action (approving high-confidence docs).

### Stats row at the top

4 stat cards: Pending count, Approved count, Reviews This Week, Average Confidence. Computed client-side from the fetched review list — no separate API needed.

### Client-side filtering and search

Filtering by status, searching by title, and sorting are all done client-side after fetching all reviews. This avoids backend complexity and works well for the expected data volume (hundreds, not thousands, of reviews per org).

### Content preview in cards

Each card shows a truncated snippet of the review content (first ~120 characters). This helps users decide whether to approve or review without opening the detail page.

## Sections

### Stats Row
- 4 cards in a grid: Pending, Approved, This Week, Avg Confidence
- Pending/Approved are simple counts
- This Week filters reviews created in the last 7 days
- Avg Confidence is the mean of all confidence scores

### Filter Tabs
- Tab buttons: All, Pending, Approved, Rejected, Needs Changes
- Each tab shows the count in parentheses
- Active tab: dark background, white text
- Inactive tabs: white background, border, muted text

### Search + Sort
- Search input: filters by document title (case-insensitive)
- Sort dropdown: Newest, Oldest, Confidence (high→low), Confidence (low→high)

### Review Cards
- Doc type badge (colored by type)
- Relative time (e.g., "2h ago", "1d ago")
- Document title (bold)
- Content preview snippet (~120 chars)
- Status badge (right side)
- Confidence bar (right side)
- Action bar at bottom:
  - Pending: Approve (green) + Review (outline) + Reject (outline)
  - Approved/Rejected/Needs Changes: View Document (outline)

### Empty State
- Shown when no reviews match the current filter/search
- Icon + "No reviews match this filter" message + suggestion text

## Components

| Component | File | Purpose |
|-----------|------|---------|
| `StatsCard` | `src/components/StatsCard.tsx` | Single stat card (label, value, optional color) |
| `FilterTabs` | `src/components/FilterTabs.tsx` | Status filter tab bar with counts |
| `EmptyState` | `src/components/EmptyState.tsx` | Empty state with icon and message |
| `Dashboard` | `src/pages/Dashboard.tsx` | Rewritten with stats, filters, search, sort |
| `ReviewCard` | `src/components/ReviewCard.tsx` | Rewritten with preview + quick actions |
| `Badge` | `src/components/Badge.tsx` | Updated with title-cased labels |

## API Changes

### Frontend: `getAllReviews()`
New function in `src/api/reviews.ts`:
```ts
export async function getAllReviews(): Promise<Review[]> {
  return request<Review[]>("/reviews");
}
```

### Backend: `GET /api/reviews`
New endpoint returning all reviews for the current org (not just pending). Ordered by `created_at DESC`.

## Content Truncation

The content preview is truncated to ~120 characters with an ellipsis. Implemented as a utility function:
```ts
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}
```

## Relative Time

Uses `Intl.RelativeTimeFormat` for human-readable time strings:
- < 1 minute: "just now"
- < 1 hour: "Xm ago"
- < 24 hours: "Xh ago"
- < 7 days: "Xd ago"
- Older: formatted date (e.g., "Jan 15")

## Trade-offs

| Decision | Trade-off |
|----------|-----------|
| Client-side filtering | Works for hundreds of reviews; would need server-side for thousands |
| Fetch all reviews at once | Simple, but could be slow for very large datasets; pagination could be added later |
| Quick approve without confirmation | Fast, but accidental clicks could publish docs; could add a confirmation step later |
| Content preview truncated | Saves space, but users may need to open detail to see full context |
