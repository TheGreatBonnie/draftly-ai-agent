# Design System

## Overview

Draftly uses a minimal, functional design focused on readability and efficiency. The review dashboard is a **React 19 SPA** with TypeScript, Vite 8, and TailwindCSS 4, served by the FastAPI backend from `frontend/dist/`. Authentication is handled by Clerk.

## Pages

### 1. Landing (`/`)
- Marketing landing page
- Public, no auth required

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
- List of all generated documentation
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

## Routes

| Route | Page | Auth | Layout |
|-------|------|------|--------|
| `/` | Landing | No | Full-width |
| `/sign-in/*` | Clerk sign-in | No | Full-width |
| `/sign-up/*` | Clerk sign-up | No | Full-width |
| `/dashboard` | Review dashboard | Yes | Sidebar + Header |
| `/review/:id` | Review detail | Yes | Sidebar + Header |
| `/reviewers` | Reviewer management | Yes | Sidebar + Header |
| `/docs` | Documentation browser | Yes | Sidebar + Header |
| `/knowledge` | Knowledge base | Yes | Sidebar + Header |
| `/memory` | Memory dashboard | Yes | Sidebar + Header |
| `/settings` | Organization settings | Yes | Sidebar + Header |

## Components

### Layout
- Full-height flex column: `AuthTokenSetter` + `Header` + (`Sidebar` | `<Outlet />`)
- Sidebar: 224px fixed width, gray-50 background, border-right
- Main content: flex-1, overflow-y-auto, 24px padding

### Sidebar
- Navigation links: Dashboard, Documentation, Knowledge Base, Memory, Settings
- Reviewers link shown only for admin/reviewer roles (via `useOrganization()`)
- Active link: blue-100 background, blue-700 text
- Inactive link: gray-600 text, hover gray-100 background

### Header
- Top bar across the full width

### AuthTokenSetter
- Syncs Clerk JWT token to the API client for authenticated requests

### ProtectedRoute
- Wraps authenticated routes, redirects to sign-in if unauthenticated

### ReviewCard
- Rounded card with border, hover shadow transition
- Header: title (bold) + status `Badge`
- Meta: doc type + date (gray-500 text-sm)
- `ConfidenceBar` for visual score
- "Review →" link to detail page

### ConfidenceBar
- Horizontal bar (96px wide, 8px tall) with fill color based on score:
  - Green (`bg-green-500`): >= 80%
  - Yellow (`bg-yellow-500`): 50–79%
  - Red (`bg-red-500`): < 50%
- Percentage label to the right

### Badge
- Rounded-full pill with color variants:
  - `pending`: yellow-100 / yellow-800
  - `approved`: green-100 / green-800
  - `rejected`: red-100 / red-800
  - `needs_changes`: orange-100 / orange-800
  - `draft`: gray-100 / gray-800
  - `in_review`: blue-100 / blue-800
  - `published`: purple-100 / purple-800

### URLImportForm
- Form for importing content from external URLs (webpages, PDFs, Google Docs, Notion)

## Styling

All styling uses **TailwindCSS 4** utility classes. No custom CSS files or CSS custom properties.

### Design Tokens (via Tailwind)

| Token | Usage |
|-------|-------|
| `blue-600` | Primary action buttons, active sidebar links |
| `green-600` | Approve actions, success states |
| `yellow-500` | Request changes, warning confidence |
| `red-600` | Reject actions, error states |
| `gray-50` | Sidebar background |
| `gray-100` | Hover states, inactive badges |
| `gray-200` | Card borders, input borders |
| `gray-500` | Secondary text, meta info |
| `gray-900` | Primary text, headings |

### Typography
- Headings: `text-2xl font-bold` (page titles), `text-lg font-semibold` (section titles)
- Body: `text-sm` (default), `text-xs` (meta, labels)
- Font: System default (Tailwind's `font-sans`)

### Layout
- Max content width: `max-w-3xl` (768px)
- Card spacing: `gap-3` or `flex flex-col gap-3`
- Card padding: `p-4` (cards), `p-6` (sections)
- Card border: `border border-gray-200 rounded-lg`

### Form Elements
- Input: `rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500`
- Button (primary): `rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50`
- Button (success): `rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700`
- Button (danger): `rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700`
- Button (outline): `rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50`

## Accessibility

- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast ratios >= 4.5:1 (Tailwind default)
- Screen reader compatible
