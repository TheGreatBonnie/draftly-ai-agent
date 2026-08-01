# Design System

## Overview

Draftly uses **"The Digital Loom"** — a dark, high-velocity technical aesthetic tailored for autonomous engineering. The visual direction represents weaving raw code into structured documentation, targeting a developer-centric audience that values precision, speed, and real-time feedback.

The style blends **Modern SaaS** with **Functional Futurism**: a deep dark mode foundation (reducing eye strain during long sessions) punctuated by vibrant, "glowing" accents that signal AI-driven activity. Visual metaphors include a subtle 1px background grid and animated scanline to evoke a high-performance terminal environment, while maintaining the approachability of a premium productivity tool.

Built with React 19, TypeScript, Vite 8, TailwindCSS 4, Clerk auth, and Material Symbols Outlined icons.

## Color Palette

The palette is engineered for a "Lights-Out" developer experience. All tokens are defined in `@theme` in `frontend/src/index.css`.

### Core Surface Layers

| Token | Hex | Role |
|-------|-----|------|
| `--color-surface` | `#0b1326` | Base canvas (also `--color-background`) |
| `--color-surface-dim` | `#0b1326` | Dim variant (same as base) |
| `--color-surface-bright` | `#31394d` | Bright variant |
| `--color-surface-container-lowest` | `#060e20` | Deepest layer |
| `--color-surface-container-low` | `#131b2e` | Sidebar, low-elevation panels |
| `--color-surface-container` | `#171f33` | Standard card/panel surface |
| `--color-surface-container-high` | `#222a3d` | Elevated surfaces, hover states |
| `--color-surface-container-highest` | `#2d3449` | Highest container layer |
| `--color-surface-variant` | `#2d3449` | Hover backgrounds, variant surfaces |
| `--color-on-surface` | `#dae2fd` | Text on any surface |
| `--color-on-surface-variant` | `#c7c4d7` | Secondary/muted text |
| `--color-background` | `#0b1326` | Page background |
| `--color-on-background` | `#dae2fd` | Text on background |

### Primary — Electric Indigo

| Token | Hex | Role |
|-------|-----|------|
| `--color-primary` | `#c0c1ff` | Primary actions, active states, AI indicators |
| `--color-primary-container` | `#8083ff` | Active nav, selected state backgrounds |
| `--color-on-primary` | `#1000a9` | Text on primary backgrounds |
| `--color-on-primary-container` | `#0d0096` | Text on primary-container |
| `--color-primary-fixed` | `#e1e0ff` | Primary fixed variant |
| `--color-primary-fixed-dim` | `#c0c1ff` | Dim primary fixed |
| `--color-inverse-primary` | `#494bd6` | Primary on inverse surfaces |

### Secondary — Cyber Mint

| Token | Hex | Role |
|-------|-----|------|
| `--color-secondary` | `#4edea3` | Success states, "Live" status, completed threads |
| `--color-secondary-container` | `#00a572` | Container variant |
| `--color-on-secondary` | `#003824` | Text on secondary |
| `--color-on-secondary-container` | `#00311f` | Text on secondary-container |

### Tertiary — Rose

| Token | Hex | Role |
|-------|-----|------|
| `--color-tertiary` | `#ffb2b7` | Alerts, breaking changes, error logs |
| `--color-tertiary-container` | `#ff516a` | Container variant |
| `--color-on-tertiary` | `#67001b` | Text on tertiary |

### Utility

| Token | Hex | Role |
|-------|-----|------|
| `--color-outline` | `#908fa0` | Primary borders |
| `--color-outline-variant` | `#464554` | Subtle borders, dividers |
| `--color-error` | `#ffb4ab` | Error text, icons |
| `--color-error-container` | `#93000a` | Error background |
| `--color-on-error` | `#690005` | Text on error |
| `--color-on-error-container` | `#ffdad6` | Text on error-container |

### Badge Status Colors

Defined as CSS utility classes in `index.css`:

| Class | Background | Text | Status |
|-------|-----------|------|--------|
| `.badge-pending` | `rgba(192,193,255,0.15)` | `#c0c1ff` | Pending review |
| `.badge-approved` | `rgba(78,222,163,0.15)` | `#4edea3` | Approved |
| `.badge-rejected` | `rgba(255,180,171,0.15)` | `#ffb4ab` | Rejected |
| `.badge-needs_changes` | `rgba(255,178,183,0.15)` | `#ffb2b7` | Changes requested |
| `.badge-draft` | `#2d3449` | `rgba(199,196,215,0.7)` | Draft |
| `.badge-in_review` | `rgba(192,193,255,0.10)` | `rgba(192,193,255,0.80)` | In review |
| `.badge-published` | `rgba(78,222,163,0.10)` | `rgba(78,222,163,0.80)` | Published |

Platform badges: `.platform-slack`, `.platform-discord`, `.platform-github` — colored by platform brand.

## Background

The page background (`#0b1326`) has a repeating 24px grid overlay:

```css
body {
  background-color: #0b1326;
  background-image:
    linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

A **scanline** animation sweeps top-to-bottom over the viewport:

```css
.scanline {
  width: 100%; height: 2px;
  background: linear-gradient(to right, transparent, rgba(192, 193, 255, 0.15), transparent);
  animation: scanline-move 4s linear infinite;
}
@keyframes scanline-move {
  0% { top: 0%; }
  100% { top: 100%; }
}
```

## Typography

Dual-font strategy distinguishes UI orchestration from technical data.

| Token | Font | Size/Weight | Usage |
|-------|------|-------------|-------|
| `headline-xl` | Inter | 40px / 700 | Page titles |
| `headline-lg` | Inter | 30px / 600 | Section headers |
| `headline-lg-mobile` | Inter | 24px / 600 | Mobile headers |
| `body-md` | Inter | 16px / 400 | Body text, nav links |
| `code-md` | JetBrains Mono | 14px / 400 | Code, technical content |
| `label-sm` | JetBrains Mono | 12px / 500 | Labels, metadata, status text |

JetBrains Mono is used for code snippets, metadata labels, logs, and system-generated information to provide an immediate visual cue that the content is technical.

## Elevation & Depth

Elevation is conveyed through **Tonal Layering** and **Luminescent Borders** rather than traditional shadows.

- **Layer 0 (Base)**: `--color-surface` (`#0b1326`) — The background workspace
- **Layer 1 (Panels)**: `--color-surface-container-low` (`#131b2e`) — Sidebar, elevated cards, with 1px solid `--color-outline-variant` border
- **Active Elevation**: When focused or "processing," a component gains a subtle outer glow: `box-shadow: 0 0 15px rgba(192, 193, 255, 0.2)` (`.glow-primary`)
- **Depth Metaphor**: 1px inner-glow highlight on top edge of cards: `box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05)` (`.inner-glow-top`)

## Shapes

| Radius | Value | Usage |
|--------|-------|-------|
| `rounded` (DEFAULT) | 0.25rem | Code blocks, internal elements |
| `rounded-lg` | 0.5rem | Cards, inputs, containers |
| `rounded-xl` | 0.75rem | Modals, featured cards |
| `rounded-2xl` | 1rem | Large containers |
| `rounded-full` | 9999px | Badges, pills, avatars |

## Layout

### App Shell

```
┌──────────┬──────────────────────────────────────────────┐
│ Sidebar  │  TopNav (h-16, backdrop-blur)                 │
│ (w-64)   ├──────────────────────────────────────────────┤
│          │  Page Content (p-8, max-w-[1600px])           │
│          │                                               │
│          │                                               │
└──────────┴──────────────────────────────────────────────┘
```

- **TopNav** (`src/components/TopNav.tsx`): Full-width header, `h-16`, `bg-background/80 backdrop-blur-md`, `border-b border-outline-variant`. Contains brand name, secondary nav tabs (Dashboard, Editor, Settings, Portal), search icon, notifications icon with error dot, and Clerk UserButton.
- **Sidebar** (`src/components/Sidebar.tsx`): `fixed left-0 top-0 w-64 h-screen`, `bg-surface-container-low`, `border-r border-outline-variant`. Contains logo with terminal icon + "DRAFTLY" + pulsing "STATUS: WATCHING" indicator, "New Draft" primary button, primary nav (Command Center, Drafts, Reviewers, Documentation, Memory, Improvements, Integrations), bottom section with Clerk user info, Settings, and Support.
- **Main**: `ml-64 flex-1 flex-col`, with TopNav at top and scrollable content area.

### Grid Overlay & Scanline

Both are positioned as `fixed inset-0 z-0` overlays in `Layout.tsx`, sitting behind all content.

## Pages

### 1. Landing (`/`)
- Marketing landing page with 6 sections: Nav, Hero, Features, How It Works, FAQ, Footer
- Public, no auth required
- Not yet migrated to dark theme

### 2. Sign In / Sign Up (`/sign-in/*`, `/sign-up/*`)
- Clerk-hosted authentication pages
- Public, no auth required

### 3. Command Center / Dashboard (`/dashboard`)
- **Agent status pill**: Pulsing secondary dot + "STATUS: WATCHING" in JetBrains Mono label
- **Stats row**: MetricCard components — Pending Reviews, Approved, Avg Confidence, Active Reviews
- **2-column layout**: Review queue (left, 2/3) + Activity feed (right, 1/3)
- **Review cards**: surface-container cards with doc-type icon, status badge, title, AI confidence indicator, action buttons
- **Activity feed**: Timeline of recent events with colored indicator dots
- **Animated background**: Neural stream visualization (EngineViz) with glowing indigo particles
- **Loading state**: Shimmer skeleton placeholders
- **Empty state**: Centered message with optional action

### 4. Drafts / Reviews (`/reviews`)
- List of all documentation drafts with status badges, confidence bars, doc-type icons
- Filter tabs (All, Pending, Approved, Rejected)
- Search input for filtering

### 5. Review Detail (`/review/:id`)
- Full document preview with markdown rendering
- Status badge, confidence comparison chart
- Document metadata panel (version, dates, type)
- Table of contents with scroll-spy highlighting
- Review form with feedback textarea and action buttons

### 6. Reviewers (`/reviewers`)
- List of reviewers with name, email, platform IDs, notification preferences
- Admin can add/edit/delete reviewers
- Reviewer self-registration prompt

### 7. Documentation / Knowledge (`/knowledge`)
- URL import form (webpages, PDFs, Google Docs, Notion)
- Manual document ingest form
- Stats overview (total docs, by type)
- Document cards with expand/collapse, status badges, delete action

### 8. Memory (`/memory`)
- Stats grid + semantic search with results
- Organization stats (support threads, docs, agents, memory entries)

### 9. Improvements (`/improvements`)
- AI improvement proposals with status tracking
- Configuration management for improvement agents
- Tab-based filtering (Proposals, Config)

### 10. Settings (`/settings`)
- **Integrations page**: Bento-grid layout with SettingsCard components
- GitHub, Slack, Discord integrations with connection status
- Global status card (system health overview)
- LogStream for real-time agent log output
- Organization settings, team roles

### 11. Help Center (`/help/*`)
- Public documentation with sidebar navigation + markdown content

## Routes

| Route | Page | Auth | Layout |
|-------|------|------|--------|
| `/` | Landing | No | Full-width |
| `/sign-in/*` | Clerk sign-in | No | Full-width |
| `/sign-up/*` | Clerk sign-up | No | Full-width |
| `/help` | Help Center | No | Landing nav + Help sidebar |
| `/dashboard` | Command Center | Yes | Sidebar + TopNav |
| `/reviews` | Drafts | Yes | Sidebar + TopNav |
| `/review/:id` | Review Detail | Yes | Sidebar + TopNav |
| `/reviewers` | Reviewer Management | Yes | Sidebar + TopNav |
| `/knowledge` | Documentation | Yes | Sidebar + TopNav |
| `/memory` | Memory | Yes | Sidebar + TopNav |
| `/improvements` | Improvements | Yes | Sidebar + TopNav |
| `/settings` | Integrations & Settings | Yes | Sidebar + TopNav |

## Components

### Layout Components

#### Layout (`src/components/Layout.tsx`)
- Flex column container with `h-screen bg-surface relative`
- Grid overlay (`fixed inset-0 grid-bg z-0`)
- Scanline animation wrapper (`fixed inset-0 overflow-hidden pointer-events-none z-0` with `.scanline` child)
- `AuthTokenSetter` + `Sidebar` + main content area

#### Sidebar (`src/components/Sidebar.tsx`)
- Fixed left, `w-64`, `h-screen`, `bg-surface-container-low`, `border-r border-outline-variant`
- **Logo**: Indigo terminal icon (`.bg-primary`, shadow glow) + "DRAFTLY" + pulsing "STATUS: WATCHING"
- **New Draft button**: `bg-primary text-on-primary-container`, full-width, glow hover
- **Nav items**: Material Symbols icons + labels, `rounded-lg`
  - Active: `bg-primary-container text-on-primary-container font-bold`
  - Inactive: `text-on-surface-variant hover:bg-surface-variant`
- **Bottom section**: Clerk UserButton + org name + Settings/Support links

#### TopNav (`src/components/TopNav.tsx`)
- `h-16`, `bg-background/80 backdrop-blur-md`, `border-b border-outline-variant`
- Left: "Draftly" brand + nav tabs (Dashboard, Editor, Settings, Portal)
- Right: Search button, notification bell with error dot, UserButton

### Dashboard Components

#### MetricCard (`src/components/MetricCard.tsx`)
- surface-container card, `rounded-lg`, inner-glow-top
- Label + value + optional trend indicator

#### StatsCard (`src/components/StatsCard.tsx`)
- Legacy glass card, `rounded-xl`, icon + label + value + optional trend

#### EngineViz (`src/components/EngineViz.tsx`)
- Animated neural network visualization with flowing particle connections
- Indigo/mint gradient glow effects

#### IngestFeedItem (`src/components/IngestFeedItem.tsx`)
- Surface-container card for displaying ingestion events
- Timestamp, source icon, status, document title

#### PendingReviewCard (`src/components/PendingReviewCard.tsx`)
- Review queue item with doc info, status badge, confidence, action buttons

#### KernelLog (`src/components/KernelLog.tsx`)
- Terminal-style log output panel with JetBrains Mono text

#### IntegrationBar (`src/components/IntegrationBar.tsx`)
- Horizontal bar showing integration connection status

#### FilterTabs (`src/components/FilterTabs.tsx`)
- Pill tabs (`rounded-lg`), active uses `bg-surface-variant`

#### EmptyState (`src/components/EmptyState.tsx`)
- Centered message with icon, title, description, optional action button

### Shared Components

#### Badge (`src/components/Badge.tsx`)
- `rounded-full` pill with CSS class-based color variants (`.badge-pending`, `.badge-approved`, etc.)

#### ConfidenceBar (`src/components/ConfidenceBar.tsx`)
- Horizontal bar with color thresholds (green >= 80%, yellow 50-79%, red < 50%)

#### ConfidenceComparison (`src/components/ConfidenceComparison.tsx`)
- Side-by-side or delta display of confidence scores

#### SettingsCard (`src/components/SettingsCard.tsx`)
- Surface-container card for integration settings (GitHub, Slack, Discord)
- Platform icon, name, status indicator, action button

#### GlobalStatusCard (`src/components/GlobalStatusCard.tsx`)
- System health overview card (agents, queues, latency, uptime)

#### LogStream (`src/components/LogStream.tsx`)
- Real-time scrolling log output with JetBrains Mono, colored by log level

#### DocTOC, DocMetadata, ReviewForm, KnowledgeCard, KnowledgeStats, URLImportForm, ConfirmDialog
- Page-specific subcomponents following the same surface-layer token system

## CSS Utilities

Defined in `frontend/src/index.css`:

### `.glow-primary`
```css
box-shadow: 0 0 15px rgba(192, 193, 255, 0.2);
```
Used on: Primary buttons, focused elements

### `.glow-secondary`
```css
box-shadow: 0 0 15px rgba(78, 222, 163, 0.15);
```
Used on: Secondary/success indicators

### `.inner-glow-top`
```css
box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
```
Used on: Cards, panels for depth

### `.pulse-ring`
```css
animation: pulse-animation 2s infinite;
@keyframes pulse-animation {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(78, 222, 163, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(78, 222, 163, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(78, 222, 163, 0); }
}
```
Used on: Status dot, "STATUS: WATCHING" indicator

### `.pulse-ring-primary`
Same animation with `rgba(192, 193, 255, ...)` colors

### `.grid-bg`
```css
background-image: linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px);
background-size: 24px 24px;
```

### `.glass-card`
```css
background: var(--color-surface-container-low);
border: 1px solid var(--color-outline-variant);
border-radius: 1rem;
box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
```

### `.glass-panel`
```css
background: var(--color-surface-container);
border: 1px solid var(--color-outline-variant);
border-radius: 1rem;
box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
```

### Scrollbar
```css
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: #2d3449 transparent;
}
```

### Animations
- `spin-slow`: 12s linear rotation
- `spin-reverse`: 20s linear reverse rotation
- `scanline-move`: 4s linear top-to-bottom sweep

## Icons

**Material Symbols Outlined** loaded via Google Fonts in `index.html`.

Icon names used:
- Navigation: `terminal`, `edit_note`, `group`, `auto_stories`, `database`, `trending_up`, `hub`
- Actions: `add`, `search`, `notifications`, `settings`, `help`
- UI: `dashboard`, `description`, `rate_review`, `check_circle`, `pending_actions`
- Brand: `auto_awesome` (logo/button, FILL=1)

Font variation for filled icons: `style={{ fontVariationSettings: "'FILL' 1" }}`

## Spacing

- Page content: `p-8`
- Section margins: `mb-8` (stats), `mb-6` (subsections)
- Card gaps: `gap-4` (lists), `gap-5` (stats grid), `gap-6` (main grid)
- Card internal: `p-4` to `p-6`
- Sidebar: `px-4 py-6`, nav items `px-3.5 py-2.5`
- TopNav: `px-8 h-16`

## Responsive Behavior

- Stats grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Main grid: `grid-cols-1 lg:grid-cols-3` (queue 2/3, activity 1/3)
- Below `lg`: activity panel stacks below reviews
- Sidebar: fixed `w-64`, no mobile collapse currently
- `max-w-[1600px]` content width constraint
- TopNav tabs hidden below `md` breakpoint

## Accessibility

- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast ratios >= 4.5:1 (dark text on light surfaces, light text on dark surfaces)
- `type="button"` on all interactive buttons
- `line-clamp-1` on truncated text
- `sr-only` for screen-reader-only labels
