# Design System

## Overview

Draftly uses a **glassmorphism** design language with cool blue-gray backgrounds, frosted-glass surfaces, and animated background orbs. The palette preserves the terracotta brand accent while adding mint as the live/positive indicator. The layout is sidebar-only (no top header bar). Built with React 19, TypeScript, Vite 8, TailwindCSS 4, and Clerk auth.

## Visual Language

- **Glassmorphism**: Translucent frosted-glass surfaces with `backdrop-filter: blur()`, layered over animated background orbs
- **Background**: Warm linen `#FAF8F5` — supports glass effect contrast
- **Surfaces**: Two tiers — `.glass-panel` (16px blur, structural) and `.glass-card` (12px blur, interactive with hover lift)
- **Border radius**: 16px (`rounded-2xl` / `rounded-xl`) for soft, modern feel
- **Typography**: Inter (body), Material Symbols Outlined (icons)
- **Motion**: Subtle — hover lifts on cards, pulsing agent status dot, shimmer loading skeletons

## Color Palette

### Primary

| Token | Hex | Role |
|-------|-----|------|
| `--color-brand` | `#e07a5f` | Terracotta — CTAs, active nav, primary actions |
| `--color-brand-hover` | `#d06a4f` | Brand hover state |
| `--color-brand-light` | `#fdf0eb` | Brand tint backgrounds (legacy) |

### Backgrounds

| Token | Hex | Role |
|-------|-----|------|
| Page background | `#FAF8F5` | Warm linen base (inline style in Layout) |
| `--color-surface` | `#faf8f5` | Warm white (legacy, used in some components) |
| `--color-surface-alt` | `#f5f0ea` | Section alternation (legacy) |
| `--color-glass` | `rgba(255,255,255,0.65)` | Glass panel background |
| `--color-glass-card` | `rgba(255,255,255,0.5)` | Glass card background |
| `--color-glass-border` | `rgba(255,255,255,0.8)` | Glass panel border |

### Text

| Token | Hex | Role |
|-------|-----|------|
| `--color-charcoal` | `#2d2a26` | Primary text |
| `--color-charcoal-light` | `#44403c` | Secondary dark |
| `--color-muted` | `#6b7280` | Secondary text, descriptions |
| `--color-faint` | `#9ca3af` | Tertiary text, labels |

### Accents

| Token | Hex | Role |
|-------|-----|------|
| `--color-mint` | `#4ECDC4` | Live status, positive trends, agent indicator |
| `--color-mint-light` | `rgba(78,205,196,0.15)` | Mint tint backgrounds |
| `--color-sage` | `#81b29a` | Success, approved states |
| `--color-sage-light` | `#e8f5e9` | Sage tint |
| `--color-sand` | `#f2cc8f` | Warning, pending states |
| `--color-sand-light` | `#fff8e1` | Sand tint |
| `--color-terracotta` | `#e07a5f` | Alias for brand (used in Badge) |
| `--color-terracotta-light` | `#fdf0eb` | Terracotta tint |

### Borders

| Token | Hex | Role |
|-------|-----|------|
| `--color-border` | `#e8e4de` | Standard borders |
| `--color-border-light` | `#e0ddd6` | Light borders |

## Layout

### App Shell (Sidebar-Only)

```
┌────────┬────────────────────────────────────────┐
│ Sidebar│  Page Content                           │
│ (glass)│                                         │
│ 280px  │                                         │
│        │                                         │
└────────┴────────────────────────────────────────┘
```

- **No top header bar** — logo, nav, user profile all in sidebar
- Sidebar: `w-[280px]`, full height, `.glass-panel` background
- Main: `flex-1`, `overflow-y-auto`, `p-8`
- Background orbs: fixed position, blurred circles behind content

### Background Orbs

Two large blurred circles create ambient depth:
- **Mint orb**: top-left, 600x600px, `#4ECDC4`, 12% opacity
- **Coral orb**: bottom-right, 700x700px, `#FF6B6B`, 12% opacity
- Both animate with a slow 20s float (defined in CSS `@keyframes float` — not currently applied, static by default)

## Pages

### 1. Landing (`/`)
- Marketing landing page with 6 sections: Nav, Hero, Features, How It Works, FAQ, Footer
- Public, no auth required
- Uses the older warm palette (terracotta brand, cream backgrounds)
- Not yet migrated to glassmorphism

### 2. Sign In / Sign Up (`/sign-in/*`, `/sign-up/*`)
- Clerk-hosted authentication pages
- Public, no auth required

### 3. Dashboard (`/dashboard`)
- **Personalized greeting**: "Good morning, Sarah." (time-of-day + Clerk `user.firstName`)
- **Agent status pill**: Pulsing mint dot + "Agent Active" text in glass capsule
- **3-column stats grid**: Pending Reviews, Approved, Avg Confidence — each in a glass card with Material Symbols icon in tinted circle
- **2-column main layout** (on large screens):
  - Left (2/3): "Action Required" section with review cards
  - Right (1/3): "Recent Activity" timeline panel
- **Review cards**: Glass cards with doc-type icon, status badge, title, excerpt, inline AI confidence pill, pill action buttons (Approve/Review for pending, View for others)
- **Activity panel**: Glass panel with vertical timeline — colored circle nodes (mint=complete, blue=edit, gray=search) with descriptive text and timestamps. Hardcoded placeholder data.
- **Loading state**: Glass shimmer skeletons (3 placeholders with gradient sweep animation)
- **Empty state**: Glass card with centered message

### 4. Review Detail (`/review/:id`)
- Full document preview (generated markdown)
- Status badge + confidence bar
- Feedback textarea (optional)
- Three action buttons: Approve (green), Request Changes (yellow), Reject (red)
- Submits decision via `decideReview()` API, navigates back to dashboard

### 5. Reviewers (`/reviewers`)
- Admin view: list all reviewers with name, email, platform IDs, notification preferences
- Admin can add reviewers via form
- Admin can delete reviewers
- Reviewer role: self-registration prompt

### 6. Documentation (`/docs`)
- List of all generated documentation
- Each card shows: title, doc type, version, date, status badge, confidence bar
- Expand/collapse to view full document content

### 7. Knowledge Base (`/knowledge`)
- URL import form (webpages, PDFs, Google Docs, Notion)
- Manual document ingest form
- List of company documents with expand/collapse, status badge, delete action

### 8. Memory (`/memory`)
- Stats grid + semantic search input with results

### 9. Settings (`/settings`)
- Organization, Team Roles, GitHub Integration, Discord Integration sections

### 10. Help Center (`/help/*`)
- Public documentation with sidebar navigation + markdown content

## Routes

| Route | Page | Auth | Layout |
|-------|------|------|--------|
| `/` | Landing | No | Full-width |
| `/sign-in/*` | Clerk sign-in | No | Full-width |
| `/sign-up/*` | Clerk sign-up | No | Full-width |
| `/help` | Help Center | No | Landing nav + Help sidebar |
| `/dashboard` | Dashboard | Yes | Sidebar only |
| `/review/:id` | Review detail | Yes | Sidebar only |
| `/reviewers` | Reviewer management | Yes | Sidebar only |
| `/docs` | Documentation browser | Yes | Sidebar only |
| `/knowledge` | Knowledge base | Yes | Sidebar only |
| `/memory` | Memory dashboard | Yes | Sidebar only |
| `/settings` | Organization settings | Yes | Sidebar only |

## Components

### Layout Components

#### Layout (`src/components/Layout.tsx`)
- Flex row: `AuthTokenSetter` + `Sidebar` + `<Outlet />`
- Background: inline `#FAF8F5` (warm linen)
- Two `.bg-orb` divs (mint top-left, coral bottom-right)
- No header bar

#### Sidebar (`src/components/Sidebar.tsx`)
- Full-height glass panel (`w-[280px]`, `.glass-panel`)
- **Logo area**: Gradient icon (terracotta→mint) + "Draftly" + "AI Documentation" subtitle
- **Nav links**: Material Symbols icons + labels, `rounded-xl` items
  - Active: `bg-white/60 text-brand shadow-sm border border-white/80`
  - Inactive: `text-muted hover:bg-white/40`
- **User profile** (bottom): Clerk `UserButton` + organization name
- **Sign-in button**: Shows for signed-out users

### Dashboard Components

#### StatsCard (`src/components/StatsCard.tsx`)
- Glass card, `h-[140px]`, `rounded-2xl`
- Top row: label (muted) + icon in tinted circle
- Bottom row: large value (32px bold) + optional trend indicator
- Props: `label`, `value`, `icon?`, `color?`, `trend?`

#### ReviewCard (`src/components/ReviewCard.tsx`)
- Glass card with `group-hover` title color transition
- Left: doc-type icon (Material Symbol in white rounded square) + badge + timestamp + title + excerpt + inline AI confidence pill
- Right: action buttons (pill-shaped, rounded-full)
  - Pending: Approve (sage) + Review (brand)
  - Non-pending: View (white outline)

#### FilterTabs (`src/components/FilterTabs.tsx`)
- Glass pill tabs (`rounded-full`)
- Active: `bg-charcoal text-white`
- Inactive: `bg-white/40 text-muted border border-white/60`

#### EmptyState (`src/components/EmptyState.tsx`)
- Glass card wrapper, centered content
- Icon + title + description + optional pill action button

#### ConfidenceBar (`src/components/ConfidenceBar.tsx`)
- Horizontal bar (w-24, h-2) with theme-aware fill colors:
  - Sage (green): >= 80%
  - Sand (yellow): 50-79%
  - Red: < 50%

#### Badge (`src/components/Badge.tsx`)
- Rounded-full pill with color variants per status

#### ActivityItem (internal to Dashboard)
- Timeline node: colored circle (border-2 border-white) with Material Symbol icon
- Text: bold title + muted meta line
- Colors: mint=complete, blue=edit, gray=search

### Shared Components

#### ConfirmDialog, AccordionItem, URLImportForm, etc.
- Unchanged from previous design

## CSS Utilities

Defined in `frontend/src/index.css`:

### `.glass-panel`
```css
background-color: rgba(255, 255, 255, 0.65);
backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.8);
box-shadow: 0 12px 40px rgba(41, 47, 54, 0.08);
```
Used for: Sidebar, Activity panel

### `.glass-card`
```css
background-color: rgba(255, 255, 255, 0.5);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.6);
transition: all 0.3s ease;
```
Hover: `translateY(-2px)`, white border, intensified shadow
Used for: Stats cards, review cards, filter tabs, empty state, agent status pill

### `.bg-orb`
```css
position: fixed;
border-radius: 50%;
filter: blur(120px);
opacity: 0.12;
pointer-events: none;
```
Used for: Background ambient orbs

### `.shimmer`
```css
position: relative;
overflow: hidden;
```
With `::after` pseudo-element: gradient sweep animation (2s infinite)
Used for: Loading skeleton placeholders

## Icons

**Material Symbols Outlined** loaded via Google Fonts in `index.html`.

Icon names used:
- Navigation: `dashboard`, `description`, `library_books`, `memory`, `settings`, `help_center`, `rate_review`
- Stats: `pending_actions`, `check_circle`, `psychology`, `trending_up`, `trending_down`
- Doc types: `code`, `menu_book`, `troubleshoot`, `lightbulb`, `new_releases`, `description`
- Activity: `check`, `edit`, `search`
- Brand: `auto_awesome` (logo, with FILL variation)

Font variation settings for filled icons: `style={{ fontVariationSettings: "'FILL' 1" }}`

## Typography

- **Body**: Inter (`--font-sans`)
- **Headings**: Same Inter font family, bold weights
- **Icons**: Material Symbols Outlined
- **Scale**:
  - Greeting: `text-[var(--text-heading)]` (1.5rem) + font-bold
  - Section headings: `text-xl font-bold`
  - Card titles: `font-semibold`
  - Body: `text-sm`
  - Meta/labels: `text-xs` or `text-[11px]`
  - Stats values: `text-[32px] font-bold leading-none`

## Spacing

- Page content: `p-8`
- Section margins: `mb-8` (stats), `mb-4` ( subsections)
- Card gaps: `gap-4` (review list), `gap-5` (stats grid), `gap-6` (main grid)
- Card internal: `p-5` to `p-6`
- Sidebar: `px-4 py-6`

## Responsive Behavior

- Stats grid: `grid-cols-1 md:grid-cols-3`
- Main grid: `grid-cols-1 lg:grid-cols-3` (reviews 2/3, activity 1/3)
- Below `lg`: activity panel stacks below reviews
- Sidebar: fixed `w-[280px]`, no mobile collapse

## Accessibility

- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast ratios >= 4.5:1
- `type="button"` on all interactive buttons
- `line-clamp-1` on truncated text
