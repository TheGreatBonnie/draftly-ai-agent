# Dashboard Glassmorphism Redesign Spec

## Overview

Redesign the Draftly frontend UI to adopt a modern glassmorphism aesthetic, inspired by the reference HTML dashboard. **Removes the top Header bar** — all header elements (logo, org badge, user button) move into the Sidebar, matching the inspiration's sidebar-only layout. Applies globally across Layout, Sidebar, and all page surfaces. The Dashboard page receives the most significant restructuring.

## Design Direction

- **Visual language**: Glassmorphism — translucent frosted-glass surfaces with `backdrop-filter: blur()`, layered over animated background orbs
- **Background**: Shift from warm cream `#faf8f5` to cool blue-gray `#F4F7FB` — better contrast for glass effects
- **Color palette**: Preserve existing terracotta brand (`#e07a5f`), sage (`#81b29a`), sand (`#f2cc8f`). Add mint (`#4ECDC4`) as the live/positive accent for agent status and trends
- **Typography**: Keep Inter as body font. Add Material Symbols Outlined for icons
- **Border radius**: Shift from 8px (`rounded-lg`) to 16px (`rounded-2xl` / `rounded-xl`) for softer, modern feel
- **Surfaces**: Two tiers — `.glass-panel` (16px blur, stronger) for structural elements (sidebar), `.glass-card` (12px blur, lighter) for content cards with hover lift
- **Layout**: Sidebar-only pattern (no top header bar). Logo, nav, user profile all in sidebar.

## Components Affected

### Global (all pages)

| Component | File | Change |
|-----------|------|--------|
| Layout | `Layout.tsx` | Remove Header import/usage, new background color, animated orbs, glass-aware main area |
| Header | `Header.tsx` | **Deleted/unused** — elements absorbed into Sidebar |
| Sidebar | `Sidebar.tsx` | Glass panel, absorbs logo area + org badge + settings link + user profile from Header, rounded-xl nav items, white/60 active state |

### Dashboard-specific

| Component | File | Change |
|-----------|------|--------|
| Dashboard | `Dashboard.tsx` | Personalized greeting (Clerk user.firstName), agent status pill, 3-col stats grid, 2-col main layout (2/3 reviews + 1/3 activity), new section headers |
| StatsCard | `StatsCard.tsx` | Glass card, icon prop, trend prop, fixed height, larger typography |
| ReviewCard | `ReviewCard.tsx` | Glass card, source icon, inline confidence badge, rounded-full CTA button, group-hover title color |
| FilterTabs | `FilterTabs.tsx` | Glass pill tabs (rounded-full), white/40 inactive, charcoal active |
| EmptyState | `EmptyState.tsx` | Glass card wrapper for consistency |
| ConfidenceBar | `ConfidenceBar.tsx` | Minor: use theme colors instead of raw gray-200/green-500 |

### New elements (no new files)

- **Agent Status Pill**: Inline in Dashboard greeting, pulsing mint dot + "Agent Active" text
- **Activity Panel**: Right column stub with hardcoded placeholder timeline items
- **Shimmer Loading**: Replace `animate-pulse` skeletons with glass shimmer effect
- **Sidebar User Profile**: Avatar + name + email at bottom of sidebar (from Clerk)

## CSS Changes

### File: `frontend/src/index.css`

**New `@theme` variables** (fixing undefined refs + new tokens):

```
--color-terracotta: #e07a5f
--color-terracotta-light: #fdf0eb
--radius-card: 16px
--shadow-card: 0 4px 24px rgba(41, 47, 54, 0.08)
--shadow-card-hover: 0 8px 32px rgba(41, 47, 54, 0.12)
--text-heading: 1.5rem
--color-glass: rgba(255, 255, 255, 0.65)
--color-glass-card: rgba(255, 255, 255, 0.5)
--color-glass-border: rgba(255, 255, 255, 0.8)
--color-mint: #4ECDC4
--color-mint-light: rgba(78, 205, 196, 0.15)
```

**New utility classes** (outside `@theme`):

- `.glass-panel` — backdrop-filter: blur(16px), white/65 bg, white/80 border, box-shadow
- `.glass-card` — backdrop-filter: blur(12px), white/50 bg, white/60 border, hover: translateY(-2px) + shadow intensify
- `.bg-orb` — fixed position, border-radius 50%, blur(120px), low opacity, pointer-events none
- `.shimmer` — loading skeleton with gradient sweep animation

### External dependency

- **Google Fonts**: Material Symbols Outlined (`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined`)
- Loaded in `frontend/index.html` `<head>`

## Layout Structure (Dashboard — Sidebar-Only)

```
┌────────┬────────────────────────────────────────┐
│ Sidebar│  Good morning, Sarah.   [Agent Active]  │
│ (glass)├──────────┬──────────┬──────────────────┤
│  Logo  │ Stat 1   │ Stat 2   │ Stat 3           │
│  Nav   ├──────────┴──────────┴──────────────────┤
│  ...   │ Tabs + Search + Sort                    │
│        ├──────────────────────┬─────────────────┤
│  ────  │ Action Required      │ Recent Activity  │
│  User  │ Review Card 1        │ (glass-panel)    │
│  Prof. │ Review Card 2        │ - auto-published │
│        │ Review Card 3        │ - drafted        │
│        │ ...                  │ - detected       │
│        │                      │ View All button  │
│        └──────────────────────┴─────────────────┘
└────────────────────────────────────────────────┘
```

## Responsive Behavior

- Stats grid: `grid-cols-1 md:grid-cols-3`
- Main grid: `grid-cols-1 lg:grid-cols-3` (reviews 2/3, activity 1/3)
- Below `lg`: activity panel stacks below reviews
- Sidebar: remains fixed width (w-56), no mobile collapse in this iteration
