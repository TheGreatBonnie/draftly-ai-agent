# Design Spec: In-App User Documentation

**Date:** 2026-07-26
**Status:** Approved
**Author:** opencode

## Problem

Draftly has no user-facing documentation. The landing page footer links to `#` (dead link). New users have no guided path to understand how to connect integrations, review documentation, or use the knowledge base. The existing `/docs` page is an AI-generated documentation browser, not a help system.

## Solution

Add a `/help` section to the React SPA with markdown-based guide pages. The section uses a nested route pattern with its own sidebar navigation, independent from the main app layout. Content is stored as markdown files and rendered via `react-markdown`.

## Design Decisions

### Route: `/help` (not `/docs`)

The `/docs` route already serves the AI-generated documentation browser. Adding user guides there would conflate two different content types. `/help` is a distinct section for platform guides.

### Public access (no auth required)

Help pages are placed outside the `ProtectedRoute` wrapper so users can read guides before signing up. This supports the conversion funnel — a visitor reads "Getting Started," then signs up.

### Standalone layout (not reusing app `Layout`)

The help section has its own `HelpLayout` with a slimmer sidebar (200px vs 224px) and no header/breadcrumbs. This avoids the cognitive overhead of the full app chrome when reading documentation.

### Markdown files with `?raw` import

Content is stored as `.md` files in `src/docs/` and imported as raw strings via Vite's `?raw` suffix. This keeps content separate from rendering logic, makes it easy to edit copy without touching components, and is portable to a future standalone docs site.

## Sections

| Route | Guide | Description |
|-------|-------|-------------|
| `/help` | Getting Started | What Draftly is, how it works, first steps |
| `/help/slack` | Slack Integration | Installing the app, configuring channels, reviewing via buttons |
| `/help/discord` | Discord Integration | Bot setup, linking servers, trigger channels, @mention workflow |
| `/help/github` | GitHub Integration | GitHub App install, linking repos, issue-triggered pipelines |
| `/help/reviews` | Reviewing Documentation | Dashboard workflow, approve/revise/reject, confidence scores |
| `/help/knowledge` | Knowledge Base | URL import, manual ingest, how it affects doc quality |

## Components

### HelpLayout

Full-height flex layout. Left: `HelpSidebar` (200px, `bg-surface`). Right: scrollable content area (`flex-1 overflow-y-auto p-8`). Renders `<Outlet />` for nested routes.

### HelpSidebar

Vertical nav list using `NavLink` from react-router. 6 items with active state (brand accent background + text) and inactive state (muted text + hover). Fixed content — no dynamic rendering.

### HelpArticle

Wraps `react-markdown` with `remark-gfm`. Applies Tailwind prose styles for typography. Takes `content: string` prop (raw markdown). Renders headings, paragraphs, lists, code blocks, links, and tables with consistent styling.

## Content Structure

Each markdown file follows this structure:
- `# Title` — page title
- `## Section` — major sections
- Numbered lists for step-by-step instructions
- Fenced code blocks for CLI commands or config examples
- Relative links to other help pages (`/help/slack`, etc.)

## Dependencies

| Package | Size | Purpose |
|---------|------|---------|
| `react-markdown` | ~40KB | Render markdown as React components |
| `remark-gfm` | ~8KB | GitHub-flavored markdown (tables, strikethrough) |

## Trade-offs

| Decision | Trade-off |
|----------|-----------|
| In-app vs standalone site | Faster to build, but not SEO-indexable or publicly linkable without the app running |
| Raw markdown vs CMS | Zero infrastructure, but content edits require code changes and redeployment |
| Public vs protected | Better conversion funnel, but no analytics on which guides users read |
| Own layout vs app layout | Cleaner reading experience, but no shared nav to jump back to the app |
