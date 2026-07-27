# Design Spec: Documentation Page UI Enhancement

**Date:** 2026-07-26
**Status:** Approved
**Author:** opencode

## Problem

The current documentation page (`/docs`) is a minimal list with plain expand/collapse for reading. It has no content previews, no search or filtering, no dedicated detail page, and bare-bones loading/error states. It does not feel production-ready for a SaaS product.

## Solution

Redesign the documentation page with two views: a rich card-based list view with filter tabs and search, and a GitBook-style dedicated detail page with rendered markdown, sticky table of contents, and document metadata.

## Design Decisions

### Browse & read as primary use case

Users come to the docs page to read their AI-generated documentation. The design prioritizes readability, content discovery, and a comfortable reading experience over management/bulk operations.

### GitBook-style detail page (Approach B)

Chosen over Notion-style (full-width, no persistent nav) and centered article (no TOC). The sticky TOC and metadata panel make a real difference for technical documentation, which is what Draftly generates. Two-column layout with content left and TOC/metadata right.

### Rich cards in list view

Cards show doc type badge, version, relative time, content preview snippet (~120 chars), status badge, and confidence bar. This matches the dashboard card pattern we already built, creating visual consistency across the app.

### Status tabs + search (same as dashboard)

Filter tabs (All, Published, Pending, Draft, Rejected) with counts + text search by title. Consistent with the dashboard pattern, reducing cognitive load for users who already know the dashboard.

### Dedicated detail page with rendered markdown

Clicking a card navigates to `/docs/:id` — a full page with rendered markdown content, not an expand/collapse inline view. This provides a proper reading experience for long technical documents.

### TOC extracted from h2 headings

The table of contents is auto-generated from h2 headings in the document. Active heading is highlighted with a terracotta left border as the user scrolls. This is the minimum viable TOC — h3 extraction can be added later if needed.

## Sections

### List View (`/docs`)

#### Page Header
- Title: "Documentation"
- Subtitle: "Browse your AI-generated documentation library."

#### Filter Tabs
- Tab buttons: All, Published, Pending, Draft, Rejected
- Maps to doc statuses: `published`, `pending`, `draft`, `rejected` (plus `approved`, `needs_changes`, `in_review` grouped under their closest tab)
- Each tab shows count in parentheses
- Active tab: charcoal background, white text
- Inactive tabs: white background, border, muted text

#### Search
- Text input right-aligned next to tabs
- Filters by document title (case-insensitive)
- Placeholder: "Search documents..."

#### Doc Cards
- Doc type badge (colored by type)
- Version number + relative time (e.g., "v2 · 2h ago")
- Document title (bold)
- Content preview snippet (~120 chars, truncated with ellipsis)
- Status badge (right side)
- Confidence bar + percentage (right side)
- Entire card is clickable → navigates to `/docs/:id`

#### Empty States
- **No docs:** Document icon + "No documentation yet" + explanation + "Connect Slack" CTA button
- **No results:** Search icon + "No documents match this filter" + suggestion text

#### Loading State
- 3 skeleton cards with pulse animation
- Matches card layout: badge placeholders, title bar, content bar

#### Error State
- Warning icon + "Failed to load documentation" + Retry button
- Clears error and re-fetches on click

### Detail Page (`/docs/:id`)

#### Layout
- Two-column: main content (flex-1) + sticky sidebar (200px)
- Sidebar stays visible while scrolling the main content
- Background: `var(--color-surface)` (#faf8f5)

#### Breadcrumb
- "← Back to Documentation" link at top
- Styled in terracotta (`var(--color-brand)`)
- Navigates back to `/docs`

#### Title Block
- Document title (h1, 22px, bold)
- Doc type badge + status badge (inline)
- Version + date (e.g., "Version 2 · Updated Jul 24, 2026")

#### Content
- Rendered markdown using the existing `.prose` CSS styles
- Dark code blocks for code snippets (background: `var(--color-charcoal)`)
- Inline code with warm background (`var(--color-surface-alt)`)

#### Table of Contents (right sidebar)
- Header: "On this page" (small, uppercase, muted)
- Auto-extracted from h2 headings in the document
- Active heading: terracotta left border + terracotta text
- Inactive headings: muted text, left padding
- Smooth scroll on click
- Highlights update on scroll (IntersectionObserver)

#### Metadata Panel (right sidebar, below TOC)
- Header: "Document Info" (small, uppercase, muted)
- Fields: Confidence (bar + %), Version, Created date, Updated date, Status badge
- Separated by border-top from TOC

#### Actions (right sidebar, below metadata)
- Header: "Actions" (small, uppercase, muted)
- Buttons: "Copy content", "Download as Markdown"
- Copy: uses Clipboard API to copy raw markdown content
- Download: creates a blob URL and triggers download as `.md` file

## Components

| Component | File | Purpose |
|-----------|------|---------|
| `DocCard` | `src/components/DocCard.tsx` | Rich doc card for list view |
| `DocDetail` | `src/pages/DocDetail.tsx` | Detail page with two-column layout |
| `DocTOC` | `src/components/DocTOC.tsx` | Sticky table of contents |
| `DocMetadata` | `src/components/DocMetadata.tsx` | Document info panel |
| `EmptyState` | `src/components/EmptyState.tsx` | Reusable empty state (already exists from dashboard) |
| `Docs` | `src/pages/Docs.tsx` | Rewritten list view |

## API Changes

No new backend endpoints needed. The existing `GET /api/docs/` returns all docs, and `GET /api/docs/:id` returns a single doc. Both are already implemented.

### Frontend additions to `src/api/docs.ts`
```ts
export async function getDoc(docId: string): Promise<Doc> {
  return request<Doc>(`/docs/${docId}`);
}
```
Already exists — no changes needed.

## Routing

Add to `App.tsx`:
```tsx
<Route path="docs/:id" element={<DocDetail />} />
```
This route goes inside the `ProtectedRoute` + `Layout` wrapper, alongside the existing `/docs` route.

## Content Truncation

Content preview truncated to ~120 characters:
```ts
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}
```

## Relative Time

Same pattern as dashboard:
- < 1 minute: "just now"
- < 1 hour: "Xm ago"
- < 24 hours: "Xh ago"
- < 7 days: "Xd ago"
- Older: formatted date (e.g., "Jul 24")

## TOC Scroll Highlighting

Uses `IntersectionObserver` to track which h2 is currently in view:
1. On mount, query all `h2` elements in the rendered content
2. Create an IntersectionObserver with `rootMargin: "-80px 0px -70% 0px"`
3. When a heading enters the observed area, update the active heading state
4. Clean up observer on unmount

## Copy & Download

### Copy Content
```ts
const handleCopy = async () => {
  await navigator.clipboard.writeText(doc.content);
  // show brief "Copied!" feedback
};
```

### Download as Markdown
```ts
const handleDownload = () => {
  const blob = new Blob([doc.content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.title.toLowerCase().replace(/\s+/g, "-")}.md`;
  a.click();
  URL.revokeObjectURL(url);
};
```

## Trade-offs

| Decision | Trade-off |
|----------|-----------|
| h2-only TOC | Simpler to implement; h3 support could be added later |
| No edit capability | Browse & read focus; editing could be a future feature |
| Client-side search | Works for hundreds of docs; server-side needed for thousands |
| No version history UI | Version number shown but no diff view; could be added later |
| Fixed 200px sidebar | Works for most screens; could be made resizable later |

## File Summary

| Action | File |
|--------|------|
| Rewrite | `src/pages/Docs.tsx` (list view with filters, search, cards) |
| Create | `src/pages/DocDetail.tsx` (detail page) |
| Create | `src/components/DocCard.tsx` (rich doc card) |
| Create | `src/components/DocTOC.tsx` (table of contents) |
| Create | `src/components/DocMetadata.tsx` (document info panel) |
| Modify | `src/App.tsx` (add `/docs/:id` route) |
| Reuse | `src/components/EmptyState.tsx` (already exists) |
| Reuse | `src/components/Badge.tsx` (already exists) |
| Reuse | `src/components/ConfidenceBar.tsx` (already exists) |
