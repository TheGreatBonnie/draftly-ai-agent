# Settings Page Redesign — Design Spec

## Overview

Redesign the Settings page (`frontend/src/pages/Settings.tsx`) to match the warm design system used across the Dashboard, Documentation, and Knowledge pages. The current page uses raw Tailwind colors, has no loading/error states, and lacks visual hierarchy.

## Design Decisions

- **Integration buttons:** Keep brand colors (green=GitHub, purple=Slack, indigo=Discord) for CTA buttons — users associate these with the services
- **Layout:** Card-based sections with warm-styled borders
- **Status overview:** Row of status badges at top showing connection status for each integration
- **Container:** No max-width constraint (matches Dashboard/Docs pattern)

## Page Layout

```
┌─────────────────────────────────────────────────────┐
│  Header: "Settings"                                 │
├─────────────────────────────────────────────────────┤
│  Status Overview: GitHub ✓ | Slack ✓ | Discord ✗    │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │  Organization Section                        │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │  Team Roles Section (admin only)             │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │  GitHub Integration Section                  │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │  Slack Integration Section                   │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │  Discord Integration Section                 │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Components

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/IntegrationCard.tsx` | Reusable integration card with brand color, status badge, CTA button |
| `src/components/StatusOverview.tsx` | Row of connection status badges |

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Settings.tsx` | Full rewrite — warm tokens, status overview, card-based sections, loading/error states |

### Files to Reuse (No Changes)

| File | Usage |
|------|-------|
| `src/components/EmptyState.tsx` | Empty states for no connected integrations |

**Note:** `Badge.tsx` is NOT reused here — it's hardcoded to document review statuses (`pending`, `approved`, etc.) and has no `connected`/`not_connected` variants. Status badges in `StatusOverview` and `IntegrationCard` use custom styled `<span>` elements with brand colors.

## Component Specifications

### StatusOverview

**Props:** `{ github: boolean; slack: boolean; discord: boolean }`

Renders a row of 3 status cards:
- **GitHub** — green when connected, gray when not
- **Slack** — purple when connected, gray when not
- **Discord** — indigo when connected, gray when not

Each card shows:
- Status dot (green/purple/indigo/gray)
- Service name
- "Connected" or "Not Set Up" text

Layout: `grid grid-cols-1 sm:grid-cols-3 gap-3` (responsive — stacks on mobile)

### IntegrationCard

**Props:** `{ title: string; description: string; connected: boolean; brandColor: string; icon: React.ReactNode; onAction: () => void; actionLabel: string; actionLoading?: boolean; children: React.ReactNode }`

A reusable card for each integration section:
- **Header:** Title + connected badge (green/purple/indigo when connected, gray when not)
- **Description:** Muted text below title
- **CTA Button:** Brand-colored button (green for GitHub, purple for Slack, indigo for Discord)
- **Content area:** `children` slot for integration-specific content (repos, workspaces, channels)
- **Connected state:** Shows connected items list
- **Disconnected state:** Shows CTA button prominently

Styling:
- Card: `rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6`
- Header: `flex items-center justify-between`
- Title: `font-semibold text-[var(--color-charcoal)]`
- Connected badge: brand-colored pill
- CTA button: brand-colored with icon

### Settings.tsx State

```typescript
// Existing state (keep as-is)
installUrl, installations, slackInstallUrl, slackInstallations
discordInviteUrl, discordStatus, guildIdInput, discordLinking
availableChannels, triggerChannelIds, triggerSaving
members, loading, error, roleLoading

// New computed state
githubConnected: boolean  // installations.length > 0
slackConnected: boolean   // slackInstallations.length > 0
discordConnected: boolean // discordStatus?.connected === true
```

### Settings.tsx Behavior

1. **Load:** Fetch all data on mount, show skeleton while loading
2. **Error:** Show error banner with retry button (calls `fetchData()`, dismisses error first)
3. **Status overview:** Show connection status for each integration
4. **Organization section:** Clerk OrganizationSwitcher + active org info
5. **Team Roles (admin only):** Member list with role dropdown
6. **GitHub:** IntegrationCard with install button + connected orgs list
7. **Slack:** IntegrationCard with connect button + connected workspaces list
8. **Discord:** IntegrationCard with connect button + guild ID input + trigger channels

### Loading Skeleton

While loading, show animate-pulse placeholders matching the final layout:
- Header skeleton: `h-7 w-32 rounded bg-[var(--color-border)]`
- Status overview: 3 card skeletons `h-20 rounded-[var(--radius-card)]`
- Section skeletons: 5 card skeletons `h-40 rounded-[var(--radius-card)]`

### Error State

- Error banner at top: `rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600`
- Includes "Retry" button that calls `fetchData()` after clearing error
- Dismissible via "Dismiss" link

### Org Name Truncation

Long org/team names use `truncate` class with `min-w-0` on the parent to prevent layout breakage.

## Styling Rules

- Container: No max-width (matches Dashboard/Docs)
- All colors via CSS custom properties (`var(--color-*)`) except:
  - Integration CTA buttons keep brand colors (green, purple, indigo)
  - Status badges use brand colors when connected
  - Error states use `red-*` (acceptable exception)
- Border radius: `var(--radius-card)` for cards, `0.5rem` for inputs/buttons
- Inputs: `border-[var(--color-border)]`, focus `border-[var(--color-charcoal)]`
- Spacing: consistent with Dashboard/Docs/Knowledge pages
- Discord channel list: `max-h-48 overflow-y-auto` (keep existing constraint)
- Clerk OrganizationSwitcher: wrapped in a warm-styled container to match design system
- Icon sizing: `h-5 w-5` for integration CTA button icons (consistent with current)

## Verification

- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Production build passes (`npx vite build`)
- [ ] No raw Tailwind color classes in Settings-related files (except brand colors)
- [ ] Loading skeletons display
- [ ] Error state with retry works
- [ ] Status overview shows correct connection status
- [ ] Each integration section renders correctly
- [ ] Team Roles section works for admin users
- [ ] Discord trigger channels toggle works
- [ ] All buttons and links functional
