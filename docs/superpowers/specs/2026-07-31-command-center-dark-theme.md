# Draftly Command Center & Dark Theme — Spec

## Vision

Replace the existing light-themed review-centric dashboard with the dark "Digital Loom" Command Center from the Stitch design. The entire app switches to dark mode. The dashboard becomes a real-time operations hub showing pipeline metrics, integration health, live activity feed, and system logs — wired to real API data.

## Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `surface` | `#0b1326` | Main page background |
| `surface-dim` | `#0b1326` | Dim variant (same as surface) |
| `surface-bright` | `#31394d` | Bright variant for contrast |
| `surface-container-lowest` | `#060e20` | Deepest layer — engine viz bg |
| `surface-container-low` | `#131b2e` | Sidebar, metric cards |
| `surface-container` | `#171f33` | Standard card background |
| `surface-container-high` | `#222a3d` | Elevated cards, hover states |
| `surface-container-highest` | `#2d3449` | Highest layer, active states |
| `on-surface` | `#dae2fd` | Primary text color |
| `on-surface-variant` | `#c7c4d7` | Secondary/muted text |
| `primary` | `#c0c1ff` | Indigo accent — active, selected, prompts |
| `primary-container` | `#8083ff` | Active nav item, badges |
| `on-primary-container` | `#0d0096` | Text on primary bg |
| `secondary` | `#4edea3` | Mint — success, live indicators, published |
| `secondary-container` | `#00a572` | Success badges |
| `tertiary` | `#ffb2b7` | Rose — alerts, warnings, time-saved |
| `tertiary-container` | `#ff516a` | Alert badges |
| `outline` | `#908fa0` | Standard borders |
| `outline-variant` | `#464554` | Subtle borders, dividers |
| `error` | `#ffb4ab` | Error text, notification dots |
| `background` | `#0b1326` | Top nav background |
| `surface-variant` | `#2d3449` | Progress bar track, hover bg |

### Typography

| Token | Font | Weight | Size | Line Ht | Letter Spacing | Usage |
|---|---|---|---|---|---|---|
| `headline-xl` | Inter | 700 | 40px | 48px | -0.02em | Metric values |
| `headline-lg` | Inter | 600 | 30px | 38px | -0.01em | Section headers |
| `body-md` | Inter | 400 | 16px | 24px | normal | Body text |
| `code-md` | JetBrains Mono | 400 | 14px | 20px | normal | Code, timestamps |
| `label-sm` | JetBrains Mono | 500 | 12px | 16px | normal | Labels, metadata, uppercase tracking |

### Shapes

| Token | Value | Usage |
|---|---|---|
| `rounded` (DEFAULT) | 0.5rem (8px) | Cards, inputs, buttons |
| `rounded-lg` | 0.75rem (12px) | Featured cards, modals |
| `rounded-xl` | 1rem (16px) | Large containers |

### Spacing

- Base unit: 4px scale
- Standard padding: 5 (20px), 6 (24px), 7 (28px), 8 (32px)
- Gutter: 6 (24px)
- Margin (desktop): 8 (32px)

## Layout Architecture

```
┌──────────────┬─────────────────────────────────────────────┐
│              │  TOP NAV (64px, backdrop-blur)              │
│   SIDEBAR    ├─────────────────────────────────────────────┤
│   (256px)    │                                             │
│              │  MAIN CONTENT (flex-1, overflow-y-auto)     │
│  fixed left  │  ┌───────────────────────────────────────┐  │
│  h-screen    │  │  12-column grid, gap-6, max-w-1600px  │  │
│              │  │  p-8                                   │  │
│              │  └───────────────────────────────────────┘  │
│              │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

### Sidebar (fixed, 256px)
- `bg-surface-container-low` + `border-r border-outline-variant`
- Logo: terminal icon + "DRAFTLY" + "STATUS: WATCHING" pulse
- "New Draft" CTA button (`bg-primary`, full glow)
- Nav items: Command Center (active = `bg-primary-container`), Drafts, Integrations, Documentation
- Bottom: Settings, Support

### TopNav (sticky, 64px)
- `bg-background/80 backdrop-blur-md` + `border-b border-outline-variant`
- Left: "Draftly" brand text + secondary nav links (Dashboard, Editor, Settings, Portal)
- Right: Search icon, Notifications icon (with red dot badge), User avatar

### Dashboard Grid (12 columns)
```
col-span-12: Metrics bar (3 cards)
col-span-8:  Engine Visualization
col-span-4:  Ingest Feed
col-span-12: System Kernel Logs
```

## Components

### MetricCard
- `bg-surface-container-low border border-outline-variant p-5 rounded-xl inner-glow-top`
- Label: `label-sm`, uppercase, tracking-widest, `on-surface-variant`
- Value: `headline-xl`, colored (primary/secondary/tertiary)
- Icon: 44x44 rounded-xl bg at 10% opacity of the metric color
- Hover: border shifts to metric color at 40% opacity

### Engine Visualization
- `bg-surface-container-lowest` with scanline overlay
- Header: "ENGINE_CORE::ACTIVE" + Live pill (pulse-ring)
- Load/Threads counters in `bg-surface-container` pills
- Central animated core: 3 concentric circles, innermost has insights icon with glow-primary
- Outer orbit: 280px circle, CSS spin animation, 2 platform nodes (bolt=secondary, bug=tertiary)
- Inner orbit: 200px circle, CSS reverse spin, 2 code nodes (code=primary, book=secondary)
- Connecting labels: floating "Ingesting Slack #product-dev" / "Updating API_DOCS.md"
- Integration bar: row of 4 progress bars (Slack, GitHub, Jira, AI Processor)

### IngestFeed
- Header: "INGEST FEED" + event count + red pulse dot
- Event items: platform icon (Slack purple / GitHub white / Discord blurple), channel/PR name, timestamp, italic quote, status tag
- Status tags: "Analyzing" (`bg-primary-container`), "Published" (`bg-secondary/15 text-secondary`), "Drafting" (`bg-tertiary/15 text-tertiary`)
- Hover: border transitions to platform-related color

### SystemKernelLogs
- Terminal aesthetic with scanline
- Header: "SYSTEM KERNEL LOGS" + IP + LIVE pulse
- Log entries: `code-md`, with random color variants (primary, secondary, default)
- Auto-scrolling: JS interval pushes new entries, removes old ones beyond 20

### Integration Bar Item
- Platform label with colored dot indicator
- Thin progress bar (`h-1.5`, `bg-surface-variant` track)
- Fill colored by integration status

## Data Integration

| Mockup Section | Real API Source | Notes |
|---|---|---|
| Threads Processed | `getAllReviews().length` | Total reviews = threads processed |
| Documentation Coverage | `getMemoryStats().documentation / (documentation + embeddings) * 100` | Coverage ratio |
| Time Saved (hrs) | `(total_reviews * 23) / 60` | 23 min avg review time × count |
| Integration Bars | `listSlackInstallations()`, `listInstallations()`, `getDiscordStatus()` | Connected = high % |
| Ingest Feed items | `getAllReviews()` | Recent reviews mapped to feed items |
| Kernel Logs | Recent review timestamps + simulated entries | Hybrid real/simulated |

### New Hook: `useDashboardData()`

```typescript
interface DashboardData {
  reviews: Review[];
  memoryStats: MemoryStats;
  slackConnected: boolean;
  githubConnected: boolean;
  discordConnected: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}
```

Fetches in parallel: `getAllReviews()`, `getMemoryStats()`, `listSlackInstallations()`, `listInstallations()`, `getDiscordStatus()`.

### Computed Metrics

```typescript
const threadsProcessed = reviews.length;
const totalDocs = memoryStats.documentation + memoryStats.embeddings;
const coverage = totalDocs > 0 ? Math.round((memoryStats.documentation / totalDocs) * 1000) / 10 : 0;
const timeSaved = Math.round((reviews.length * 23) / 6) / 10;
```

## Animations

All CSS-based, respecting `prefers-reduced-motion`:

| Animation | Element | Implementation |
|---|---|---|
| Orbit spin | Outer/inner orbital rings | `@keyframes spin-slow 12s linear infinite` |
| Reverse orbit | Inner ring | `@keyframes spin-reverse 20s linear infinite` |
| Pulse ring | Live/status dots | `@keyframes pulse-animation 2s infinite` |
| Scanline | Log section overlay | `@keyframes scanline-move 4s linear infinite` |
| Glow | Primary elements | `box-shadow: 0 0 15px rgba(192,193,255,0.2)` |
| Log feed | Kernel logs | `setInterval()` pushes new entry every 3.5s |
| Sidebar hover | Nav links | `shadow-[0_0_8px_rgba(192,193,255,0.08)]` on hover |

## Responsive Behavior

| Breakpoint | Layout Changes |
|---|---|
| `>= 1024px` | Full 3-pane, 12-col grid |
| `768px - 1023px` | Sidebar collapses to 64px icon-only; engine viz goes full width; ingest feed below |
| `< 768px` | Single column; sidebar as overlay (drawer); metrics stack; all sections full width |

## Loading & Empty States

- **Loading**: `animate-pulse` skeleton cards using `bg-surface-container-highest` for all sections
- **Error**: Centered message with error icon + retry button, dark themed
- **Empty feed**: "No events yet" message with muted icon

---

## Files to Create / Modify

| File | Action |
|---|---|
| `frontend/src/index.css` | **Rewrite** — full dark theme tokens + utility classes |
| `frontend/src/components/Layout.tsx` | **Rewrite** — remove orbs, add grid bg, TopNav integration |
| `frontend/src/components/Sidebar.tsx` | **Rewrite** — dark Stitch sidebar |
| `frontend/src/components/TopNav.tsx` | **Create** — dark top navigation bar |
| `frontend/src/pages/Dashboard.tsx` | **Rewrite** — full Command Center with data hooks |
| `frontend/src/hooks/useDashboardData.ts` | **Create** — aggregated data fetching hook |
| `frontend/src/components/StatsCard.tsx` | **Rewrite** — dark metric card |
| `frontend/src/components/ReviewCard.tsx` | **Edit** — dark theme styling |
| `frontend/src/components/Badge.tsx` | **Edit** — dark theme colors |
| `frontend/src/components/FilterTabs.tsx` | **Edit** — dark theme styling |
| `frontend/src/components/EmptyState.tsx` | **Edit** — dark theme colors |
| `frontend/src/components/IntegrationBar.tsx` | **Create** — progress bar for integrations |
| `frontend/src/components/IngestFeedItem.tsx` | **Create** — feed event card |
| `frontend/src/components/KernelLog.tsx` | **Create** — scrolling log component |
| `frontend/src/components/EngineViz.tsx` | **Create** — animated engine visualization |

### Theme transition note

Existing pages (Reviews, Knowledge, Memory, Settings, Improvements, Help) reference old color tokens like `var(--color-charcoal)`, `var(--color-muted)`, `var(--color-brand)`, and CSS classes like `glass-panel`, `glass-card`, `bg-orb`. After the theme change, these will break visually. The plan must update these references to the new dark tokens.

### Migration strategy

- Replace `var(--color-charcoal)` → `var(--color-on-surface)`
- Replace `var(--color-muted)` → `var(--color-on-surface-variant)`
- Replace `var(--color-border)` → `var(--color-outline-variant)`
- Replace `var(--color-brand)` → `var(--color-primary)`
- Replace `var(--color-brand-hover)` → `var(--color-primary-container)`
- Replace `var(--color-brand-light)` → `var(--color-primary-container)`
- Replace `var(--color-surface)` → `var(--color-surface-container)`
- Replace `var(--color-surface-alt)` → `var(--color-surface-container-low)`
- Replace `glass-panel` / `glass-card` → use `bg-surface-container-low` + `border-outline-variant`
- Replace `bg-orb` → remove (light-theme element)

Only existing tokens that map directly to new ones should be search-and-replaced. Components that need structural changes (like ReviewCard's approve buttons) should be individually updated.
