# Knowledge Base Page Redesign — Design Spec

## Overview

Redesign the Knowledge Base page (`frontend/src/pages/Knowledge.tsx`) to match the warm design system used across the Dashboard and Documentation pages. The current page uses raw Tailwind colors, has no loading/error states, no search/filter, and plain form styling.

## Design Decisions

- **Primary use case:** Adding docs (input-heavy) — forms should be prominent
- **Form layout:** Tabbed ("Import from URL" | "Add Manually")
- **URLImportForm:** Refactored to use warm design tokens
- **Doc list:** Rich cards (like DocCard pattern)
- **Stats:** Simple 4-card row (Total, Published, Pending, Drafts)

## Page Layout

```
┌─────────────────────────────────────────────────────┐
│  Header: "Knowledge Base" + subtitle                │
├─────────────────────────────────────────────────────┤
│  Stats Row: Total | Published | Pending | Drafts    │
├─────────────────────────────────────────────────────┤
│  Tabbed Form: "Import from URL" | "Add Manually"   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Active tab content (form fields)            │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  List Header: "Documents (N)" + FilterTabs + Search │
│  ┌─────────────────────────────────────────────┐   │
│  │  Rich doc cards                              │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Components

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/KnowledgeCard.tsx` | Rich doc card with type badge, preview, status, confidence, actions |
| `src/components/KnowledgeStats.tsx` | Stats row (4 StatsCard components) |
| `src/components/ConfirmDialog.tsx` | Reusable delete confirmation modal |

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Knowledge.tsx` | Full rewrite — tabs, stats, filtering, search, error/loading states |
| `src/components/URLImportForm.tsx` | Accept `active` prop, refactor to warm design tokens |

### Files to Reuse (No Changes)

| File | Usage |
|------|-------|
| `src/components/FilterTabs.tsx` | Filter bar for doc list |
| `src/components/EmptyState.tsx` | Empty states for no docs / no results |
| `src/components/Badge.tsx` | Status badges on doc cards |
| `src/components/StatsCard.tsx` | Stats row cards |
| `src/utils/format.ts` | `truncate()`, `relativeTime()`, `formatDate()` |

## Component Specifications

### KnowledgeStats

**Props:** `{ docs: KnowledgeDoc[] }`

Computes and displays 4 stat cards:
- **Total Documents** — `docs.length` — no color (default charcoal)
- **Published** — count where `status === "published"` — `color="var(--color-sage)"`
- **Pending Review** — count where `status === "pending"` — `color="var(--color-sand)"`
- **Drafts** — count where `status === "draft"` — no color (default charcoal)

Uses existing `StatsCard` component.

### KnowledgeCard

**Props:** `{ doc: KnowledgeDoc; onDelete: (id: string) => void }`

Layout:
```
┌──────────────────────────────────────┐
│  Title                               │
│  [type-badge] v1 · 2 days ago       │
│  Preview of first ~150 chars...      │
│  ──────────────────────────────────  │
│  [Status Badge] 95% confidence       │
│                          [View] [🗑] │
└──────────────────────────────────────┘
```

- **Title:** `font-semibold`, charcoal
- **Meta line:** Type badge (color-coded by doc type) + version + relative time
- **Preview:** Content truncated to ~150 chars via `truncate()`, muted color, 2-line clamp
- **Footer:** Status `Badge` + confidence percentage + Delete button
- **Type badge colors:**
  - `howto` → sage
  - `faq` → sand
  - `tutorial` → blue
  - `troubleshooting` → terracotta
  - `reference` → gray
- **Delete:** Opens `ConfirmDialog`

### ConfirmDialog

**Props:** `{ open: boolean; title: string; description: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }`

- Modal overlay with centered dialog
- Title + description text
- Cancel (outline) + Confirm (danger or primary) buttons
- `danger` prop makes confirm button red
- Closes on overlay click or Escape key

### Tabbed Form Section

Integrated into `Knowledge.tsx` (not a separate component):

- **Tab bar:** Two tabs with warm styling
  - Active: charcoal text, terracotta bottom border
  - Inactive: muted text, transparent bottom border, hover → charcoal
- **Tab 1: Import from URL** — renders `URLImportForm`
- **Tab 2: Add Manually** — inline form with:
  - Title input (full width)
  - Document Type dropdown (styled with warm tokens)
  - Content textarea (6 rows)
  - Submit button (terracotta) + Cancel button (outline)

### URLImportForm Refactor

Changes from current:
1. Accept `active: boolean` prop — when not active, render nothing
2. Replace all `gray-*` / `blue-*` / `bg-gray-800` classes with warm design tokens
3. Button uses `bg-[var(--color-charcoal)]` instead of `bg-gray-800`
4. Inputs use `border-[var(--color-border)]` instead of `border-gray-300`
5. Focus states use `border-[var(--color-charcoal)]` instead of `border-blue-500`
6. Remove `mb-8` outer margin (parent controls spacing)

### Knowledge.tsx State

```typescript
// Existing state
docs: KnowledgeDoc[]
loading: boolean
expanded: string | null  // remove (no longer needed with cards)
title, content, docType, submitting, error  // form state

// New state
activeTab: "url" | "manual"      // tab switcher
filter: string                     // status filter ("all" | "published" | "pending" | "draft")
search: string                     // search query
deleteTarget: KnowledgeDoc | null  // doc being deleted (for ConfirmDialog)
```

### Knowledge.tsx Behavior

1. **Load:** Fetch docs on mount, show skeleton while loading
2. **Filter:** `FilterTabs` with tabs: All, Published, Pending, Draft (with counts)
3. **Search:** Input filters by doc title (case-insensitive)
4. **Delete:** Click delete → `ConfirmDialog` → confirm → call `deleteKnowledge()` → remove from list. On error: show error message, keep item in list.
5. **Add (URL):** Tab 1 → URLImportForm handles full flow → reload list on success
6. **Add (Manual):** Tab 2 → fill form → `ingestKnowledge()` → reload list → switch to Tab 1. On error: show error message below form, stay on Tab 2.
7. **Error:** Show error message with Retry button (same pattern as Dashboard/Docs)
8. **Loading:** Show 3 skeleton cards (animate-pulse)
9. **Empty (no docs):** `EmptyState` with "Import from URL" CTA
10. **Empty (no results):** `EmptyState` with "Try a different filter" message

## Styling Rules

- Container: `max-w-5xl` (matches Dashboard/Docs pages)
- All colors via CSS custom properties (`var(--color-*)`)
- No raw Tailwind color classes (`gray-*`, `blue-*`, `red-*`) in new or modified files
  - Exception: `Badge.tsx` is reused as-is and contains raw colors for status variants — this is acceptable since it's not being modified
- Border radius: `0.75rem` for cards, `0.5rem` for inputs/buttons
- Button primary: `bg-[var(--color-brand)]` (terracotta)
- Button secondary: `bg-[var(--color-charcoal)]`
- Button outline: `border-[var(--color-border)]`
- Inputs: `border-[var(--color-border)]`, focus `border-[var(--color-charcoal)]`
- Spacing: consistent with Dashboard/Docs pages

## Verification

- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Production build passes (`npx vite build`)
- [ ] No raw Tailwind color classes in Knowledge-related files
- [ ] Tab switching works correctly
- [ ] URL import flow works end-to-end
- [ ] Manual form submits and reloads list
- [ ] Delete confirmation modal appears and works
- [ ] Filter tabs filter correctly
- [ ] Search filters by title
- [ ] Loading skeletons display
- [ ] Error state with retry works
- [ ] Empty states display correctly
