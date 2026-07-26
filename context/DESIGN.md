# Design System

## Overview

Draftly uses a warm, approachable design with a terracotta accent palette. The app is a **React 19 SPA** with TypeScript, Vite 8, and TailwindCSS 4, served by the FastAPI backend from `frontend/dist/`. Authentication is handled by Clerk.

## Pages

### 1. Landing (`/`)
- Marketing landing page with 6 sections: Nav, Hero, Features, How It Works, FAQ, Footer
- Public, no auth required
- Signed-out users see full marketing content
- Signed-in users see Clerk `OrganizationList` for org selection

### 2. Sign In / Sign Up (`/sign-in/*`, `/sign-up/*`)
- Clerk-hosted authentication pages
- Public, no auth required

### 3. Dashboard (`/dashboard`)
- Card-based view of pending reviews
- Each card shows: title, doc type, date, status badge, confidence bar
- Links to review detail page
- Empty state: "No pending reviews."

### 4. Review Detail (`/review/:id`)
- Full document preview (generated markdown in `<pre>` block)
- Status badge + confidence bar
- Feedback textarea (optional)
- Three action buttons: Approve (green), Request Changes (yellow), Reject (red)
- Submits decision via `decideReview()` API, navigates back to dashboard

### 5. Reviewers (`/reviewers`)
- Admin view: list all reviewers with name, email, platform IDs, notification preferences
- Admin can add reviewers via form (name, email, Slack/Discord IDs, notification toggles)
- Admin can delete reviewers
- Reviewer role: self-registration prompt with notification preference form
- Shows "You" badge for current user

### 6. Documentation (`/docs`)
- List of all generated documentation (AI-generated docs from DB)
- Each card shows: title, doc type, version, date, status badge, confidence bar
- Expand/collapse to view full document content
- Empty state: "No documentation yet."

### 7. Knowledge Base (`/knowledge`)
- URL import form (fetches content from webpages, PDFs, Google Docs, Notion)
- Manual document ingest form (title, doc type selector, content textarea)
- List of company documents with expand/collapse, status badge, delete action
- Doc types: howto, faq, tutorial, troubleshooting, reference

### 8. Memory (`/memory`)
- 3-column stats grid: Support Threads, Documentation, Embeddings, Review Sessions, Agent Memory, Audit Logs
- Semantic search input with results showing content type, similarity score, and text snippet

### 9. Settings (`/settings`)
- Organization section: Clerk `OrganizationSwitcher`, active org name + role display
- Team Roles section (admin only): list org members with role dropdown (Member / Reviewer / Admin)
- GitHub Integration section: install GitHub App button, list connected orgs with repo counts
- Discord Integration section: Guild ID input + Link button, trigger channel selector (multi-select), invite URL display with permissions (36932), Copy button

### 10. Help Center (`/help/*`)
- User documentation and guides, publicly accessible (no auth required)
- Own layout with sidebar navigation + content area
- Markdown-based content rendered via `react-markdown` + `remark-gfm`
- 6 guides: Getting Started, Slack, Discord, GitHub, Reviews, Knowledge Base

## Routes

| Route | Page | Auth | Layout |
|-------|------|------|--------|
| `/` | Landing | No | Full-width |
| `/sign-in/*` | Clerk sign-in | No | Full-width |
| `/sign-up/*` | Clerk sign-up | No | Full-width |
| `/help` | Help Center (Getting Started) | No | Landing nav + Help sidebar |
| `/help/slack` | Slack Integration Guide | No | Landing nav + Help sidebar |
| `/help/discord` | Discord Integration Guide | No | Landing nav + Help sidebar |
| `/help/github` | GitHub Integration Guide | No | Landing nav + Help sidebar |
| `/help/reviews` | Reviewing Documentation | No | Landing nav + Help sidebar |
| `/help/knowledge` | Knowledge Base Guide | No | Landing nav + Help sidebar |
| `/dashboard` | Review dashboard | Yes | Sidebar + Header |
| `/review/:id` | Review detail | Yes | Sidebar + Header |
| `/reviewers` | Reviewer management | Yes | Sidebar + Header |
| `/docs` | Documentation browser | Yes | Sidebar + Header |
| `/knowledge` | Knowledge base | Yes | Sidebar + Header |
| `/memory` | Memory dashboard | Yes | Sidebar + Header |
| `/settings` | Organization settings | Yes | Sidebar + Header |

## Components

### Landing Components (`src/components/landing/`)

#### LandingNav
- Sticky nav bar with logo, section links, and auth CTA
- Logo: terracotta "D" icon + "Draftly" text
- Links: Features, How It Works, FAQ, Docs
- Signed-out: Sign In link + Get Started button
- Signed-in: Dashboard button

#### LandingHero
- Purple eyebrow badge ("Autonomous Documentation")
- Headline: "Turn conversations into documentation — automatically"
- Subtitle describing the product
- Dual CTA: Start Free (primary) + See How It Works (outline)
- Trust badges: No credit card, Free tier, 2-min setup
- "Already have an account? Sign In" link for returning users

#### LandingFeatures
- 6-card grid: Multi-Platform Ingest, AI Research Pipeline, Human-in-the-Loop, Semantic Memory, Confidence Scoring, Versioned Docs
- Each card: colored icon box, title, description

#### LandingHowItWorks
- 3-step numbered process: Connect Your Channels, AI Generates Docs, Review & Publish
- Colored circles (terracotta, sage, sand)

#### LandingFAQ
- 5 accordion items using `AccordionItem` component
- Questions: How it works, platforms, approval, customization, security

#### LandingFooter
- Dark charcoal background, 4-column layout
- Brand column, Product, Resources (with /help link), Legal
- Copyright line

### AccordionItem (`src/components/AccordionItem.tsx`)
- Reusable FAQ accordion with expand/collapse
- Chevron icon rotates on open
- Uses `useState` for toggle state

### Help Center Components (`src/components/help/`)

#### HelpLayout
- Full-height flex layout with `LandingNav` at top
- Left: `HelpSidebar` (200px, `bg-surface`)
- Right: scrollable content area with `max-w-3xl` container
- Renders `<Outlet />` for nested routes

#### HelpSidebar
- Vertical nav list with 6 guide links
- Uses `NavLink` with active state (brand accent) and inactive state (muted)

#### HelpArticle
- Wraps `react-markdown` with `remark-gfm`
- Applies `.prose` styles for typography
- Takes `content: string` prop (raw markdown)

### App Components (`src/components/`)

#### Layout
- Full-height flex column: `AuthTokenSetter` + `Header` + (`Sidebar` | `<Outlet />`)
- Sidebar: 224px fixed width, gray-50 background, border-right
- Main content: flex-1, overflow-y-auto, 24px padding

#### Sidebar
- Navigation links: Dashboard, Documentation, Knowledge Base, Memory, Settings
- Reviewers link shown only for admin/reviewer roles (via `useOrganization()`)
- Active link: blue-100 background, blue-700 text
- Inactive link: gray-600 text, hover gray-100 background

#### Header
- Top bar across the full width

#### AuthTokenSetter
- Syncs Clerk JWT token to the API client for authenticated requests

#### ProtectedRoute
- Wraps authenticated routes, redirects to sign-in if unauthenticated

#### ReviewCard
- Rounded card with border, hover shadow transition
- Header: title (bold) + status `Badge`
- Meta: doc type + date (gray-500 text-sm)
- `ConfidenceBar` for visual score
- "Review →" link to detail page

#### ConfidenceBar
- Horizontal bar (96px wide, 8px tall) with fill color based on score:
  - Green (`bg-green-500`): >= 80%
  - Yellow (`bg-yellow-500`): 50–79%
  - Red (`bg-red-500`): < 50%
- Percentage label to the right

#### Badge
- Rounded-full pill with color variants:
  - `pending`: yellow-100 / yellow-800
  - `approved`: green-100 / green-800
  - `rejected`: red-100 / red-800
  - `needs_changes`: orange-100 / orange-800
  - `draft`: gray-100 / gray-800
  - `in_review`: blue-100 / blue-800
  - `published`: purple-100 / purple-800

#### URLImportForm
- Form for importing content from external URLs (webpages, PDFs, Google Docs, Notion)

## Styling

All styling uses **TailwindCSS 4** utility classes with a custom `@theme` block in `index.css`.

### Theme Tokens (`@theme` in `index.css`)

| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | Inter, system-ui | Base typeface |
| `--color-brand` | `#e07a5f` | Primary accent (terracotta) |
| `--color-brand-hover` | `#d06a4f` | Brand hover state |
| `--color-brand-light` | `#fdf0eb` | Brand tint backgrounds |
| `--color-surface` | `#faf8f5` | Page background (warm white) |
| `--color-surface-alt` | `#f5f0ea` | Section alternation |
| `--color-charcoal` | `#2d2a26` | Primary text |
| `--color-charcoal-light` | `#44403c` | Secondary dark |
| `--color-muted` | `#6b7280` | Secondary text |
| `--color-faint` | `#9ca3af` | Tertiary text |
| `--color-border` | `#e8e4de` | Borders |
| `--color-border-light` | `#e0ddd6` | Light borders |
| `--color-sage` | `#81b29a` | Success/secondary accent |
| `--color-sage-light` | `#e8f5e9` | Sage tint |
| `--color-sand` | `#f2cc8f` | Highlight/warmth accent |
| `--color-sand-light` | `#fff8e1` | Sand tint |

### Prose Styles (for markdown rendering)

The `.prose` class provides typography for markdown content:
- Headings: `text-charcoal`, proper size scale, bold
- Paragraphs: `text-muted`, `text-sm`, leading-relaxed
- Code blocks: `bg-surface`, monospace, border, padding
- Inline code: `bg-surface`, monospace, small, rounded
- Links: `text-brand`, underline
- Tables: full width, border-collapse
- Blockquotes: left brand border, italic

### Typography
- Landing hero: `text-[42px] font-bold leading-[1.15] tracking-tight`
- Section headings: `text-[26px] font-bold`
- Card titles: `text-sm font-semibold`
- Body: `text-sm` (default), `text-xs` (meta, labels)
- Font: Inter via `@theme` (`--font-sans`)

### Layout
- Landing max width: `max-w-5xl` (features, how-it-works), `max-w-3xl` (hero)
- Help content max width: `max-w-3xl`
- Card spacing: `gap-5` (feature grid)
- Card padding: `p-5` (feature cards)
- Card border: `border border-border rounded-[11px]`

### Form Elements
- Input: `rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand`
- Button (primary): `rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover`
- Button (dark): `rounded-lg bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-charcoal-light`
- Button (outline): `rounded-lg border border-border-light bg-white px-6 py-2.5 text-sm font-medium text-charcoal hover:bg-surface`

## Accessibility

- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast ratios >= 4.5:1
- Screen reader compatible
- `type="button"` on all interactive buttons to prevent form submission
