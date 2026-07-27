# Dashboard Redesign Design Spec

**Date:** 2026-07-27
**Status:** Draft
**Page:** `/` (Dashboard)

## Overview

Redesign the Dashboard to be visually richer and more informative, incorporating layout patterns from the reference glassmorphism design while maintaining the warm Draftly aesthetic. The dashboard will feature a two-column layout with an action queue and activity timeline.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visual style | Warm with subtle glass touches | Keeps Draftly identity, adds depth |
| Color palette | Keep Terracotta/Sage/Sand | Consistent with existing design system |
| Typography | Add Space Grotesk for headings | Adds visual hierarchy, matches reference |
| Layout | 2/3 + 1/3 grid | Action-focused left, activity feed right |
| Stats cards | Enhanced with icons + trends | More informative, matches reference |
| Activity feed | Derived from reviews data | No new backend needed |
| Background effects | Subtle gradient orbs | Adds depth without distraction |
| Card interactions | Hover lift effect | Adds polish |

## Layout Structure

```
┌──────────────────────────────────────────────────────┐
│  Header (greeting + agent status indicator)           │
├──────────────────────────────────────────────────────┤
│  Stats Row (4 cards with icons + trends)              │
├──────────────────────────┬───────────────────────────┤
│  Action Queue (2/3)      │  Activity Feed (1/3)      │
│  - Pending reviews       │  - Recent actions         │
│  - Source integration    │  - Timestamped entries    │
│  - Confidence badges     │  - "View All" button      │
│  - Error state variant   │                           │
└──────────────────────────┴───────────────────────────┘
```

## Component Specifications

### 1. Background Orbs (CSS only)

Two fixed, blurred gradient circles at very low opacity:
- **Mint orb**: top-left, 500px, `var(--color-sage)` at 0.08 opacity
- **Coral orb**: bottom-right, 600px, `var(--color-brand)` at 0.06 opacity
- Subtle float animation (20s infinite alternate)

### 2. Enhanced Stats Cards

Each card has:
- Icon badge (circle with tinted background)
- Large value display
- Trend indicator (e.g., `+12%` with arrow) or subtitle
- Subtle hover lift (`translateY(-2px)`)

| Card | Icon | Color | Value |
|------|------|-------|-------|
| Pending Reviews | `pending` | Sand | Count |
| Approved | `check_circle` | Sage | Count |
| This Week | `date_range` | Muted | Count |
| Avg Confidence | `psychology` | Terracotta | Percentage |

### 3. Action Queue (Left Column)

Section header: "Action Required" with pending count badge.

Each action card shows:
- **Source icon**: Integration logo (Slack/GitHub/Discord) or generic doc icon
- **Title**: Review document title
- **Description**: One-line preview of content
- **Confidence badge**: "AI Confidence: XX%" with brain icon
- **CTA button**: "Review" (terracotta, rounded-full)

**Error state variant**: When a review has issues:
- Red left border (1px)
- Grayscale source icon
- Error message in red
- "Fix Issue" button (white/outline)

### 4. Activity Feed (Right Column)

Vertical timeline with:
- Colored dot indicators (sage for approved, blue for drafted, gray for detected)
- Event description with bold document names
- Timestamp + context (e.g., "10 mins ago • Confidence threshold met")
- "View All History" button at bottom

**Activity types derived from reviews:**
- `approved` — "Agent auto-published [title]" (sage dot)
- `drafted` — "Agent drafted [title]" (blue dot)
- `needs_changes` — "Review requested for [title]" (sand dot)
- `rejected` — "Rejected [title]" (red dot)

### 5. Header Enhancement

- Personalized greeting: "Good morning, [Name]."
- Subtitle: "Your AI agent has been busy. Here's what's happening."
- Agent status indicator: Animated ping dot + "Agent Listening" text

## Design Tokens

### New Tokens to Add

| Token | Value | Usage |
|-------|-------|-------|
| `--color-sage` | `#81b29a` | Already exists |
| `--color-brand` | `#e07a5f` | Already exists |
| `--radius-card` | `16px` | Card border radius |
| `--shadow-card` | `0 4px 20px rgba(0,0,0,0.06)` | Card hover shadow |
| `--shadow-glass` | `0 8px 32px rgba(0,0,0,0.04)` | Glass panel shadow |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page heading | Space Grotesk | 32px | 700 |
| Section heading | Space Grotesk | 20px | 600 |
| Stat value | Space Grotesk | 32px | 700 |
| Card title | Inter | 15px | 600 |
| Body text | Inter | 14px | 400 |
| Caption | Inter | 12px | 400 |

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/index.css` | Modify | Add Space Grotesk font, orb animations, glass utilities |
| `frontend/src/pages/Dashboard.tsx` | Modify | Restructure layout, add activity feed |
| `frontend/src/components/StatsCard.tsx` | Modify | Add icon, trend, hover effect |
| `frontend/src/components/ReviewCard.tsx` | Modify | Add source icon, confidence badge, error state |
| `frontend/src/components/ActivityFeed.tsx` | Create | Timeline component |
| `frontend/src/components/ActionQueue.tsx` | Create | Pending reviews queue |
| `frontend/src/components/BackgroundOrbs.tsx` | Create | Animated background |

## Acceptance Criteria

- [ ] Space Grotesk font loads for headings
- [ ] Background orbs render at low opacity with animation
- [ ] Stats cards show icons and trend indicators
- [ ] Stats cards have hover lift effect
- [ ] Action queue shows pending reviews in 2/3 width
- [ ] Action cards show source integration icons
- [ ] Action cards display confidence badges
- [ ] Error state variant renders with red border
- [ ] Activity feed shows recent actions in 1/3 width
- [ ] Activity feed has timestamped entries
- [ ] Header shows personalized greeting
- [ ] Agent status indicator animates
- [ ] All existing functionality works (filter, search, sort)
- [ ] TypeScript compiles without errors
- [ ] Build passes
