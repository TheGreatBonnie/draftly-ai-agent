# Settings Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Settings page to match the warm design system with status overview, card-based sections, and proper loading/error states.

**Architecture:** Create two reusable components (`IntegrationCard`, `StatusOverview`) then rewrite `Settings.tsx` using them. All existing functionality preserved.

**Tech Stack:** React 19, TypeScript, TailwindCSS 4, Clerk auth

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/components/IntegrationCard.tsx` | **Create** | Reusable integration card with brand color, status badge, CTA |
| `src/components/StatusOverview.tsx` | **Create** | Row of 3 connection status badges |
| `src/pages/Settings.tsx` | **Rewrite** | Warm tokens, status overview, card-based sections, loading/error |

---

## Task 1: Create IntegrationCard Component

**Files:**
- Create: `frontend/src/components/IntegrationCard.tsx`

- [ ] **Step 1: Create the IntegrationCard component**

```tsx
// frontend/src/components/IntegrationCard.tsx

import type { ReactNode } from "react";

interface IntegrationCardProps {
  title: string;
  description: string;
  connected: boolean;
  brandColor: string;
  icon: ReactNode;
  onAction: () => void;
  actionLabel: string;
  actionLoading?: boolean;
  children: ReactNode;
}

export function IntegrationCard({
  title,
  description,
  connected,
  brandColor,
  icon,
  onAction,
  actionLabel,
  actionLoading = false,
  children,
}: IntegrationCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--color-charcoal)]">{title}</h2>
            <p className="mt-0.5 text-sm text-[var(--color-muted)]">{description}</p>
          </div>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{
            backgroundColor: connected ? `${brandColor}20` : "var(--color-surface-alt)",
            color: connected ? brandColor : "var(--color-muted)",
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: connected ? brandColor : "var(--color-faint)" }}
          />
          {connected ? "Connected" : "Not Set Up"}
        </span>
      </div>

      <div className="mt-5">
        {connected ? (
          children
        ) : (
          <div className="py-4 text-center">
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors"
              style={{
                backgroundColor: brandColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              {icon}
              {actionLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/IntegrationCard.tsx
git commit -m "feat(settings): add IntegrationCard component"
```

---

## Task 2: Create StatusOverview Component

**Files:**
- Create: `frontend/src/components/StatusOverview.tsx`

- [ ] **Step 1: Create the StatusOverview component**

```tsx
// frontend/src/components/StatusOverview.tsx

interface StatusOverviewProps {
  github: boolean;
  slack: boolean;
  discord: boolean;
}

interface StatusCardProps {
  name: string;
  connected: boolean;
  brandColor: string;
}

function StatusCard({ name, connected, brandColor }: StatusCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: connected ? brandColor : "var(--color-faint)" }}
        />
        <span className="font-medium text-[var(--color-charcoal)]">{name}</span>
      </div>
      <p className="mt-1 pl-5 text-xs text-[var(--color-muted)]">
        {connected ? "Connected" : "Not Set Up"}
      </p>
    </div>
  );
}

export function StatusOverview({ github, slack, discord }: StatusOverviewProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatusCard name="GitHub" connected={github} brandColor="#16a34a" />
      <StatusCard name="Slack" connected={slack} brandColor="#9333ea" />
      <StatusCard name="Discord" connected={discord} brandColor="#4f46e5" />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StatusOverview.tsx
git commit -m "feat(settings): add StatusOverview component"
```

---

## Task 3: Rewrite Settings Page — Loading & Error States

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Replace loading state with skeleton**

Replace the current loading state (lines 205-207) with:
```tsx
if (loading) {
  return (
    <div className="space-y-6">
      <div className="h-7 w-32 animate-pulse rounded bg-[var(--color-border)]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
          />
        ))}
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Replace error state with banner + retry**

Replace the current error state (lines 209-211) with:
```tsx
if (error && !installUrl) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--color-charcoal)]">Settings</h1>
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
        <div className="flex items-center justify-between">
          <span>{error}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-500 underline hover:text-red-700"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                fetchData();
              }}
              className="rounded bg-red-100 px-3 py-1 text-red-700 hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat(settings): add loading skeleton and error banner"
```

---

## Task 4: Rewrite Settings Page — Container & Header

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Update container and header in the return statement**

Replace the container `<div>` and `<h1>` (lines 213-215) with:
```tsx
return (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-[var(--color-charcoal)]">Settings</h1>

    {/* Status Overview */}
    <StatusOverview
      github={installations.length > 0}
      slack={slackInstallations.length > 0}
      discord={discordStatus?.connected === true}
    />
```

- [ ] **Step 2: Add StatusOverview import**

Add to the imports at the top of the file:
```tsx
import { StatusOverview } from "../components/StatusOverview";
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat(settings): add status overview and update container"
```

---

## Task 5: Rewrite Settings Page — Organization Section

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Rewrite Organization section with warm tokens**

Replace the Organization section (lines 217-239) with:
```tsx
{/* Organization */}
<section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
  <h2 className="font-semibold text-[var(--color-charcoal)]">Organization</h2>
  <p className="mt-1 text-sm text-[var(--color-muted)]">
    Switch between organizations or manage team settings.
  </p>
  <div className="mt-4">
    <OrganizationSwitcher />
  </div>
  {organization && (
    <div className="mt-4 text-sm text-[var(--color-charcoal-light)]">
      <p>
        Active: <strong>{organization.name}</strong>
        {membership && (
          <span>
            {" "}
            — Role: <strong>{membership.role}</strong>
          </span>
        )}
      </p>
    </div>
  )}
</section>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat(settings): update Organization section with warm tokens"
```

---

## Task 6: Rewrite Settings Page — Team Roles Section

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Rewrite Team Roles section with warm tokens**

Replace the Team Roles section (lines 242-287) with:
```tsx
{/* Team Roles (admin only) */}
{isAdmin && (
  <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
    <h2 className="font-semibold text-[var(--color-charcoal)]">Team Roles</h2>
    <p className="mt-1 text-sm text-[var(--color-muted)]">
      Assign roles to organization members. Members with the{" "}
      <strong>Reviewer</strong> role can register themselves as reviewers for
      documentation.
    </p>

    {members.length > 0 ? (
      <div className="mt-4 divide-y divide-[var(--color-border-light)]">
        {members.map((member) => (
          <div
            key={member.user_id}
            className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-charcoal)]">
                {member.email}
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                ID: {member.user_id}
              </p>
            </div>
            <select
              value={member.role}
              onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
              disabled={roleLoading === member.user_id}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm focus:border-[var(--color-charcoal)] focus:ring-1 focus:ring-[var(--color-charcoal)] disabled:opacity-50">
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        No organization members found.
      </p>
    )}
  </section>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat(settings): update Team Roles section with warm tokens"
```

---

## Task 7: Rewrite Settings Page — GitHub Section

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Rewrite GitHub section using IntegrationCard**

Replace the GitHub section (lines 289-370) with:
```tsx
{/* GitHub Integration */}
<IntegrationCard
  title="GitHub Integration"
  description="Connect Draftly to your GitHub repositories to automatically generate documentation from issues."
  connected={installations.length > 0}
  brandColor="#16a34a"
  icon={
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  }
  onAction={() => {
    if (installUrl?.install_url) {
      window.open(installUrl.install_url, "_blank", "noopener,noreferrer");
    }
  }}
  actionLabel="Install GitHub App"
>
  <div className="space-y-3">
    {installations.map((inst) => (
      <div
        key={inst.id}
        className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface-alt)] p-3">
        <div className="flex items-center justify-between">
          <span className="min-w-0 truncate font-medium text-[var(--color-charcoal)]">
            {inst.github_org}
          </span>
          <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            Connected
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {Array.isArray(inst.repositories) ? inst.repositories.length : 0}{" "}
          {Array.isArray(inst.repositories) && inst.repositories.length === 1
            ? "repository"
            : "repositories"}{" "}
          accessible
        </p>
        {Array.isArray(inst.repositories) && inst.repositories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {inst.repositories.map((repo) => (
              <span
                key={repo.full_name}
                className="rounded bg-[var(--color-border)] px-1.5 py-0.5 text-xs text-[var(--color-charcoal-light)]">
                {repo.full_name}
              </span>
            ))}
          </div>
        )}
      </div>
    ))}
  </div>
</IntegrationCard>
```

- [ ] **Step 2: Add IntegrationCard import**

Add to the imports at the top of the file:
```tsx
import { IntegrationCard } from "../components/IntegrationCard";
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat(settings): rewrite GitHub section with IntegrationCard"
```

---

## Task 8: Rewrite Settings Page — Slack Section

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Rewrite Slack section using IntegrationCard**

Replace the Slack section (lines 372-428) with:
```tsx
{/* Slack Integration */}
<IntegrationCard
  title="Slack Integration"
  description="Connect Draftly to your Slack workspace to automatically generate documentation from support requests."
  connected={slackInstallations.length > 0}
  brandColor="#9333ea"
  icon={
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.522h-6.313z" />
    </svg>
  }
  onAction={() => {
    if (slackInstallUrl) {
      window.open(slackInstallUrl, "_blank", "noopener,noreferrer");
    }
  }}
  actionLabel="Connect Slack Workspace"
>
  <div className="space-y-3">
    {slackInstallations.map((inst) => (
      <div
        key={inst.id}
        className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface-alt)] p-3">
        <div className="flex items-center justify-between">
          <span className="min-w-0 truncate font-medium text-[var(--color-charcoal)]">
            {inst.team_name}
          </span>
          <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
            Connected
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Bot ID: {inst.bot_user_id}
        </p>
      </div>
    ))}
  </div>
</IntegrationCard>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat(settings): rewrite Slack section with IntegrationCard"
```

---

## Task 9: Rewrite Settings Page — Discord Section

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Rewrite Discord section using IntegrationCard**

Replace the Discord section (lines 430-528) with:
```tsx
{/* Discord Integration */}
<IntegrationCard
  title="Discord Integration"
  description="Connect Draftly to your Discord server to automatically generate documentation from support requests."
  connected={discordStatus?.connected === true}
  brandColor="#4f46e5"
  icon={
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  }
  onAction={() => {
    if (discordInviteUrl?.invite_url) {
      window.open(discordInviteUrl.invite_url, "_blank", "noopener,noreferrer");
    }
  }}
  actionLabel="Add to Discord Server"
>
  <div className="space-y-4">
    {/* Guild ID input (when not connected) */}
    {!discordStatus?.connected && (
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="block text-sm font-medium text-[var(--color-charcoal)]">
            Server (Guild) ID
          </label>
          <input
            type="text"
            value={guildIdInput}
            onChange={(e) => setGuildIdInput(e.target.value)}
            placeholder="e.g. 123456789012345678"
            className="mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:border-[var(--color-charcoal)] focus:ring-1 focus:ring-[var(--color-charcoal)]"
          />
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Right-click your server name in Discord → Copy Server ID
          </p>
        </div>
        <button
          type="button"
          onClick={handleDiscordLink}
          disabled={discordLinking || !guildIdInput.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {discordLinking ? "Connecting..." : "Connect"}
        </button>
      </div>
    )}

    {/* Connected state */}
    {discordStatus?.connected && (
      <>
        <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface-alt)] p-3">
          <div className="flex items-center justify-between">
            <span className="min-w-0 truncate font-medium text-[var(--color-charcoal)]">
              Guild: {discordStatus.guild_id}
            </span>
            <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              Connected
            </span>
          </div>
        </div>

        {/* Trigger Channels */}
        <div>
          <h3 className="text-sm font-medium text-[var(--color-charcoal)]">
            Trigger Channels
          </h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Select channels where the bot responds to @mentions. Leave empty to
            disable all triggers.
            {triggerSaving && (
              <span className="ml-2 text-indigo-600">Saving...</span>
            )}
          </p>
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-2">
            {availableChannels.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)]">No channels found</p>
            ) : (
              availableChannels.map((ch) => (
                <label
                  key={ch.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[var(--color-surface-alt)]">
                  <input
                    type="checkbox"
                    checked={triggerChannelIds.includes(ch.id)}
                    onChange={() => handleToggleChannel(ch.id)}
                    disabled={triggerSaving}
                    className="h-4 w-4 rounded border-[var(--color-border)] text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[var(--color-charcoal)]">#{ch.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </>
    )}
  </div>
</IntegrationCard>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat(settings): rewrite Discord section with IntegrationCard"
```

---

## Task 10: Final Verification

**Files:**
- Verify: `frontend/src/components/IntegrationCard.tsx`
- Verify: `frontend/src/components/StatusOverview.tsx`
- Verify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Production build**

Run: `cd frontend && npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Lint check**

Run: `cd frontend && npx eslint src/components/IntegrationCard.tsx src/components/StatusOverview.tsx src/pages/Settings.tsx`
Expected: No errors

- [ ] **Step 4: Verify no raw Tailwind colors**

Run: `cd frontend && grep -n "text-gray\|bg-gray\|border-gray\|text-green-\|bg-green-\|text-purple-\|bg-purple-\|text-indigo-\|bg-indigo-" src/pages/Settings.tsx`
Expected: No matches (except brand colors in IntegrationCard props)

- [ ] **Step 5: Verify all sections render**

Manual verification:
- Loading skeleton shows while data loads
- Error banner with retry works
- Status overview shows correct connection status
- Organization section renders with Clerk switcher
- Team Roles section works for admin users
- GitHub section shows install button / connected orgs
- Slack section shows connect button / connected workspaces
- Discord section shows connect button / guild input / trigger channels

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(settings): complete settings page redesign"
```
