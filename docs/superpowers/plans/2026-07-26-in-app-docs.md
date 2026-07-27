# Implementation Plan: In-App User Documentation

**Date:** 2026-07-26
**Spec:** `docs/superpowers/specs/2026-07-26-in-app-docs-design.md`
**Status:** Ready to execute

## Steps

### Step 1: Install dependencies

```bash
cd frontend && npm install react-markdown remark-gfm
```

### Step 2: Add prose styles to `index.css`

Add a `.prose` utility block to `index.css` for markdown-rendered content:
- Headings: `text-charcoal`, proper size scale, bold, margin
- Paragraphs: `text-muted`, `text-sm`, leading-relaxed, margin-bottom
- Lists: proper indentation, margin, marker styling
- Code blocks: `bg-surface`, monospace font, border, padding, overflow-x-auto
- Inline code: `bg-surface`, monospace, small, rounded
- Links: `text-brand`, underline, hover state
- Tables: full width, border-collapse, cell padding/borders
- Blockquotes: left border, `text-muted`, italic
- Horizontal rules: `border-border`

### Step 3: Create markdown guide files

Create `frontend/src/docs/` directory with 6 files:

1. `getting-started.md` — What Draftly is, 3-step overview, signing up, creating an org, first integration, first doc generation
2. `slack.md` — Slack app installation, channel configuration, triggering from threads, reviewing via Block Kit buttons, notification settings
3. `discord.md` — Bot setup, server linking, trigger channel config, @mention workflow, reviewing via Discord buttons
4. `github.md` — GitHub App installation, repo linking, issue-triggered pipelines, reviewing via dashboard
5. `reviews.md` — Review workflow explanation, dashboard navigation, approve/revise/reject actions, confidence scores, post-approval behavior
6. `knowledge.md` — What the knowledge base is, URL import, manual document ingest, how it affects doc generation quality

### Step 4: Create HelpArticle component

Create `frontend/src/components/help/HelpArticle.tsx`:
- Accepts `content: string` prop
- Renders via `<Markdown remarkPlugins={[remarkGfm]} className="prose">` 
- Applies the `.prose` styles from Step 2

### Step 5: Create HelpSidebar component

Create `frontend/src/components/help/HelpSidebar.tsx`:
- 200px wide, `bg-surface`, border-right
- 6 `NavLink` items: Getting Started, Slack, Discord, GitHub, Reviews, Knowledge Base
- Active: `bg-brand-light text-brand font-medium`
- Inactive: `text-muted hover:text-charcoal hover:bg-gray-100`
- All links use `end` prop except index

### Step 6: Create HelpLayout component

Create `frontend/src/components/help/HelpLayout.tsx`:
- Full-height flex layout (`flex h-screen flex-col`)
- `HelpSidebar` on left (200px)
- Scrollable content area on right (`flex-1 overflow-y-auto p-8`)
- Renders `<Outlet />`

### Step 7: Create Help.tsx index page

Create `frontend/src/pages/Help.tsx`:
- Imports `getting-started.md?raw`
- Renders `<HelpArticle content={gettingStarted} />`
- Wraps in a `max-w-3xl mx-auto` container

### Step 8: Update App.tsx routing

Add nested `/help` routes **outside** the `ProtectedRoute` group:

```tsx
<Route path="help" element={<HelpLayout />}>
  <Route index element={<Help />} />
  <Route path="slack" element={<HelpArticle content={slack} />} />
  <Route path="discord" element={<HelpArticle content={discord} />} />
  <Route path="github" element={<HelpArticle content={github} />} />
  <Route path="reviews" element={<HelpArticle content={reviews} />} />
  <Route path="knowledge" element={<HelpArticle content={knowledge} />} />
</Route>
```

Each guide route imports its markdown file via `?raw` and passes it to `HelpArticle`.

### Step 9: Update landing page links

- `LandingFooter.tsx`: Change Documentation `<a href="#">` → `<Link to="/help">`
- `LandingNav.tsx`: No change needed (nav doesn't have a docs link for signed-out users, but could optionally add one)

### Step 10: Verify

- `npx tsc --noEmit` — TypeScript compiles
- `npx eslint src/ --max-warnings=0` — no new lint errors
- `npx vite build` — production build passes
- Manual: navigate to `/help`, click through all 6 guides, verify markdown renders correctly

## File Summary

| Action | File |
|--------|------|
| Create | `frontend/src/docs/getting-started.md` |
| Create | `frontend/src/docs/slack.md` |
| Create | `frontend/src/docs/discord.md` |
| Create | `frontend/src/docs/github.md` |
| Create | `frontend/src/docs/reviews.md` |
| Create | `frontend/src/docs/knowledge.md` |
| Create | `frontend/src/components/help/HelpArticle.tsx` |
| Create | `frontend/src/components/help/HelpSidebar.tsx` |
| Create | `frontend/src/components/help/HelpLayout.tsx` |
| Create | `frontend/src/pages/Help.tsx` |
| Modify | `frontend/src/index.css` (add `.prose` styles) |
| Modify | `frontend/src/App.tsx` (add `/help` routes) |
| Modify | `frontend/src/components/landing/LandingFooter.tsx` (update link) |
| Modify | `frontend/package.json` (new deps) |
