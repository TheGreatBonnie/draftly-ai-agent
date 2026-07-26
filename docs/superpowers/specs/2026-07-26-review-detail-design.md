# ReviewDetail Page Design Spec

**Date:** 2026-07-26
**Status:** Approved
**Page:** `/reviews/:id`

## Overview

Redesign the ReviewDetail page to be production-ready, consistent with the warm & approachable design system used throughout Draftly. The current page has no loading states, raw Tailwind colors, plain `<pre>` content rendering, and a non-functional review form.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Content rendering | Formatted markdown | User confirmed content should be readable, not raw text |
| Layout | Single column | Clean, focused, mobile-friendly |
| Review form | Expandable panel | Keeps focus on content first, opens on demand |
| Confidence display | Before/After comparison | Shows impact of the review, most informative |
| Utility features | None | Keep minimal, no copy/download buttons |
| Error recovery | Retry + Back link | Standard error UX, allows recovery |
| Architecture | Hybrid (4 sub-components) | Clean separation, easy to test |

## States

### Loading State
- Skeleton placeholders for all sections
- Pulsing animation
- No content visible

### Error State
- Red border card with error message
- "Retry" button (terracotta)
- "← Back to Reviews" link (warm gray)

### Loaded State

#### ReviewHeader
- Back navigation link (← Back, terracotta)
- Status badge (Pending/Approved/Changes Requested/Rejected)
- Review title (20px, 700 weight)
- Requester name + relative time

#### ConfidenceComparison
- Warm gray card (`#f8f6f3`)
- Before: large number (45%)
- Arrow → 
- After: large number (67%, sage green)
- Delta badge: +22% (green background)

#### ReviewContent
- White card with warm border
- "Documentation" section header
- Markdown rendered content with prose styles
- Proper paragraph spacing, lists, code blocks

#### ReviewForm (Expandable)
- Collapsed: dashed border, "Ready to review?" text, "Open Review Panel" button
- Expanded: textarea + 3 action buttons
  - Approve (sage green)
  - Request Changes (sand)
  - Reject (red)

## Component Architecture

```
src/pages/ReviewDetail.tsx          # Container: state, data fetching, routing
├── ReviewHeader.tsx                # Back nav, status badge, title, requester, time
├── ConfidenceComparison.tsx        # Before → After with delta indicator
├── ReviewContent.tsx               # Markdown rendered content in card
└── ReviewForm.tsx                  # Expandable panel: textarea + approve/changes/reject
```

## Design Tokens

| Element | Token | Value |
|---------|-------|-------|
| Background | `bg-warm-50` | `#faf8f5` |
| Card background | `bg-white` | `#ffffff` |
| Card border | `border-warm-200` | `#e8e4de` |
| Text primary | `text-warm-900` | `#2d2a26` |
| Text secondary | `text-warm-500` | `#6b7280` |
| Confidence before | `text-warm-900` | `#2d2a26` |
| Confidence after | `text-sage-600` | `#81b29a` |
| Delta badge bg | `bg-sage-50` | `#e8f5e9` |
| Delta badge text | `text-sage-600` | `#81b29a` |
| Approve button | `bg-sage-600` | `#81b29a` |
| Changes button | `bg-sand-400` | `#f2cc8f` |
| Reject button | `bg-red-500` | `#ef4444` |
| Back link | `text-terracotta-500` | `#e07a5f` |

## Markdown Rendering

Use `react-markdown` with `remark-gfm` for:
- GFM (tables, strikethrough, task lists)
- Proper paragraph spacing
- Code block syntax highlighting (optional, can add later)

Apply Tailwind Typography `prose` classes for consistent text styling.

## Existing Code Issues to Fix

1. `className="bg-gray-50"` → `className="bg-warm-50"`
2. `<pre className="whitespace-pre-wrap">{content}</pre>` → Markdown renderer
3. No loading skeleton → Add skeleton
4. No error handling → Add error state with retry
5. No back navigation → Add back link
6. Buttons are `type="button"` but not wired → Wire to `decideReview()`
7. Missing `isSubmitting` state → Add local submitting state

## Dependencies

- `react-markdown` — Markdown rendering (already in package.json)
- `remark-gfm` — GFM support (already in package.json)

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/ReviewHeader.tsx` | Create | Back nav, status, title, requester, time |
| `src/components/ConfidenceComparison.tsx` | Create | Before → After with delta |
| `src/components/ReviewContent.tsx` | Create | Markdown rendered card |
| `src/components/ReviewForm.tsx` | Create | Expandable review panel |
| `src/pages/ReviewDetail.tsx` | Modify | Use new components, add loading/error |

## Acceptance Criteria

- [ ] Loading skeleton displays while fetching
- [ ] Error state shows with retry and back link
- [ ] Back navigation returns to reviews list
- [ ] Confidence shows before → after with delta
- [ ] Content renders as formatted markdown
- [ ] Review form is collapsed by default
- [ ] Review form expands with textarea and 3 buttons
- [ ] All buttons wired to `decideReview()` API
- [ ] TypeScript compiles without errors
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (no new errors)
