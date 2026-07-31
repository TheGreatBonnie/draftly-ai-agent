# Settings Page — Stitch Design Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Settings/Integrations page to match the stitch mockup in `stitch_output/integrations_settings.html` — bento grid layout, surface-layer tokens, typography scale, global status card, log stream, and toggle switches.

**Architecture:** Add typography tokens to the existing `@theme` block in `index.css` so Tailwind v4 generates utility classes. Create three new components (`SettingsCard`, `GlobalStatusCard`, `LogStream`) for the bento grid cards, header status area, and log stream. Rewrite `Settings.tsx` to use them in the new layout while preserving Organization/Team Roles sections. Remove `IntegrationCard` usage (the bento card replaces it).

**Tech Stack:** React 19 + Tailwind CSS v4 (CSS-driven `@theme`) + existing design tokens already in `index.css`. No icon library added — keep existing inline SVGs.

---

### Task 1: Add typography scale to @theme

**Files:**
- Modify: `frontend/src/index.css:3-47`

The stitch mockup uses specific font sizes beyond Tailwind's defaults. Add them to the existing `@theme` block so classes like `text-headline-xl`, `text-body-md`, `text-label-sm`, `text-code-md` become available. These map to the same Inter/JetBrains Mono fonts already configured.

- [ ] **Step 1: Add typography tokens inside the @theme block**

Insert after the `--radius-xl` line, before the closing `}` of `@theme`:

```css
  /* Typography scale */
  --text-headline-xl: 40px;
  --text-headline-xl--line-height: 48px;
  --text-headline-xl--letter-spacing: -0.02em;
  --text-headline-xl--font-weight: 700;
  --text-headline-lg: 30px;
  --text-headline-lg--line-height: 38px;
  --text-headline-lg--letter-spacing: -0.01em;
  --text-headline-lg--font-weight: 600;
  --text-body-md: 16px;
  --text-body-md--line-height: 24px;
  --text-body-md--font-weight: 400;
  --text-code-md: 14px;
  --text-code-md--line-height: 20px;
  --text-code-md--font-weight: 400;
  --text-label-sm: 12px;
  --text-label-sm--line-height: 16px;
  --text-label-sm--font-weight: 500;
```

- [ ] **Step 2: Verify the build doesn't break**

```bash
npm run build 2>&1 | tail -5
```
Expected: Build succeeds with no errors. If `npm run build` isn't configured, use `npx tailwindcss -i src/index.css -o /dev/null`.

---

### Task 2: Create SettingsCard component

**Files:**
- Create: `frontend/src/components/SettingsCard.tsx`

A bento-grid card matching the stitch mockup's integration card anatomy:

```
┌─────────────────────────────────────┐
│ [icon]  Title           [Connected] │
│         ID: XXX-123                 │
├─────────────────────────────────────┤
│ Description text about integration  │
│                                     │
│ Feature A          [toggle on]      │
│ Feature B          [toggle off]     │
├─────────────────────────────────────┤
│      [Action Button →]              │
└─────────────────────────────────────┘
```

Props: `icon`, `title`, `description`, `id`, `connected`, `features` (array of `{label, sublabel, enabled}`), `actionLabel`, `onAction`, `children` (for expanded content like repo lists, shown only when connected), `inactive` (grayscale+dimmed when true).

- [ ] **Step 1: Create SettingsCard.tsx**

```tsx
import type { ReactNode } from "react";

interface ToggleFeature {
  label: string;
  sublabel: string;
  enabled: boolean;
}

interface SettingsCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  id: string;
  connected: boolean;
  features: ToggleFeature[];
  actionLabel: string;
  onAction: () => void;
  children?: ReactNode;
}

export function SettingsCard({
  icon,
  title,
  description,
  id,
  connected,
  features,
  actionLabel,
  onAction,
  children,
}: SettingsCardProps) {
  const inactive = !connected;
  return (
    <div
      className={`group bg-surface-container border border-outline-variant hover:border-primary/50 transition-all duration-300 rounded-xl overflow-hidden flex flex-col ${
        inactive ? "opacity-60 grayscale-[0.5]" : ""
      }`}
    >
      {/* Header */}
      <div className="p-6 border-b border-outline-variant/30 flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-lg border border-outline-variant flex items-center justify-center p-2 [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain">
            {icon}
          </div>
          <div>
            <h3 className="text-on-surface font-bold text-lg">{title}</h3>
            <span className="text-[10px] font-mono text-on-surface-variant">ID: {id}</span>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${
            connected
              ? "bg-secondary-container text-on-secondary-container"
              : "bg-surface-variant text-on-surface-variant border border-outline-variant"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? "bg-white animate-pulse" : "bg-on-surface-variant/50"
            }`}
          />
          {connected ? "Connected" : "Inactive"}
        </span>
      </div>

      {/* Body */}
      <div className={`p-6 space-y-6 flex-1 ${inactive ? "pointer-events-none" : ""}`}>
        <p className="text-body-md text-on-surface-variant leading-relaxed">
          {description}
        </p>
        <div className="space-y-4">
          {features.map((feature) => (
            <div key={feature.label} className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-on-surface">
                  {feature.label}
                </span>
                <span className="text-xs text-on-surface-variant">
                  {feature.sublabel}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={feature.enabled}
                  readOnly
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
              </label>
            </div>
          ))}
        </div>

        {connected && children && (
          <div className="pt-2 border-t border-outline-variant/20">
            {children}
          </div>
        )}
      </div>

      {/* Footer */}
      <button
        type="button"
        onClick={onAction}
        className={`p-4 border-t border-outline-variant/30 transition-all flex justify-center items-center gap-2 text-sm font-bold ${
          connected
            ? "bg-surface-container-low hover:bg-surface-variant text-primary"
            : "bg-surface-container-low hover:bg-primary hover:text-on-primary group-hover:bg-primary group-hover:text-on-primary text-on-surface-variant"
        }`}
      >
        {actionLabel}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No type errors in the new file.

---

### Task 3: Create GlobalStatusCard component

**Files:**
- Create: `frontend/src/components/GlobalStatusCard.tsx`

The "Global Agent Status" card that sits next to the page header. Shows agent status, source count, and status tags.

- [ ] **Step 1: Create GlobalStatusCard.tsx**

```tsx
interface GlobalStatusCardProps {
  sourceCount: number;
}

export function GlobalStatusCard({ sourceCount }: GlobalStatusCardProps) {
  return (
    <div className="bg-surface-container-high border border-outline-variant p-6 rounded-xl flex items-center gap-6 min-w-[320px] relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-1 opacity-10 pointer-events-none">
        <svg className="w-20 h-20 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
      <div className="relative z-10 w-3 h-3 bg-secondary rounded-full shadow-[0_0_8px_rgba(78,222,163,0.6)] before:content-[''] before:absolute before:w-[300%] before:h-[300%] before:left-[-100%] before:top-[-100%] before:rounded-full before:bg-secondary/40 before:animate-ping" />
      <div className="relative z-10">
        <div className="text-label-sm font-mono text-on-surface-variant uppercase tracking-widest mb-1">
          Global Agent Status
        </div>
        <div className="text-headline-lg text-secondary">
          Watching <span className="font-mono">{sourceCount}</span> Sources
        </div>
        <div className="flex gap-2 mt-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-secondary/30 text-secondary bg-secondary/10">
            INGEST_ON
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-outline-variant text-on-surface-variant bg-surface-variant/30">
            MONITOR_ACTIVE
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No type errors.

---

### Task 4: Create LogStream component

**Files:**
- Create: `frontend/src/components/LogStream.tsx`

A terminal-style log stream at the bottom of the page. Shows timestamped log entries with colored severity badges.

- [ ] **Step 1: Create LogStream.tsx**

```tsx
interface LogEntry {
  time: string;
  level: "SUCCESS" | "INFO" | "SYNC" | "IDLE";
  message: string;
}

const DEFAULT_LOGS: LogEntry[] = [
  { time: "14:22:05", level: "SUCCESS", message: "All integrations connected and monitoring." },
  { time: "14:22:12", level: "INFO", message: "GitHub Webhook active. Listening for PR events." },
  { time: "14:22:18", level: "SYNC", message: "Slack channel mapping synchronized." },
  { time: "14:23:45", level: "IDLE", message: "Monitoring 3 sources. No new delta detected." },
];

const LEVEL_STYLES: Record<LogEntry["level"], string> = {
  SUCCESS: "text-secondary",
  INFO: "text-primary",
  SYNC: "text-secondary",
  IDLE: "text-tertiary",
};

export function LogStream() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
      <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-container">
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h2 className="font-mono text-sm text-on-surface uppercase tracking-wider">
            Live Agent Log Stream
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[10px] font-mono text-on-surface-variant flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            ENGINE_STABLE
          </div>
          <div className="w-px h-4 bg-outline-variant" />
          <button
            type="button"
            className="text-[10px] font-mono text-primary hover:underline"
            onClick={() => {}}
          >
            CLEAR_LOGS
          </button>
        </div>
      </div>
      <div className="p-6 font-mono text-xs text-on-surface-variant space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
        {DEFAULT_LOGS.map((log, i) => (
          <div key={i} className="flex gap-4">
            <span className="text-outline shrink-0">{log.time}</span>
            <span className={`${LEVEL_STYLES[log.level]} shrink-0`}>
              [{log.level}]
            </span>
            <span className={log.level === "IDLE" ? "text-on-surface-variant" : "text-on-surface"}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No type errors.

---

### Task 5: Rewrite Settings.tsx

**Files:**
- Modify: `frontend/src/pages/Settings.tsx` (full rewrite)
- Remove import: `IntegrationCard`
- Remove import: `StatusOverview`

The page layout becomes:

```
┌──────────────────────────────────────────────────┐
│ [h1] Integrations                  [Status Card] │
│ subtitle text                                    │
├──────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ │ Settings │ │ GitHub   │ │ Slack    │          │
│ │  Card    │ │  Card    │ │  Card    │          │
│ └──────────┘ └──────────┘ └──────────┘          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ │ Discord  │ │Request   │ │(empty)   │          │
│ │  Card    │ │Integr.   │ │          │          │
│ └──────────┘ └──────────┘ └──────────┘          │
├──────────────────────────────────────────────────┤
│ Organization section (restyled)                   │
│ Team Roles section (restyled, admin only)         │
├──────────────────────────────────────────────────┤
│ Log Stream                                        │
└──────────────────────────────────────────────────┘
```

The actions (GitHub install, Slack connect, Discord link) remain the same — only the visual presentation changes.

- [ ] **Step 1: Replace imports at top of Settings.tsx**

Old:
```tsx
import { IntegrationCard } from "../components/IntegrationCard";
import { StatusOverview } from "../components/StatusOverview";
```

New:
```tsx
import { SettingsCard } from "../components/SettingsCard";
import { GlobalStatusCard } from "../components/GlobalStatusCard";
import { LogStream } from "../components/LogStream";
```

- [ ] **Step 2: Replace loading skeleton**

Old (lines 207-227):
```tsx
if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-32 animate-pulse rounded-full bg-white/60" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass-card h-20 animate-pulse rounded-2xl"
            />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="glass-card h-40 animate-pulse rounded-2xl"
          />
        ))}
      </div>
    );
  }
```

New:
```tsx
if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-surface-container-high" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-container" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-surface-container" />
        ))}
      </div>
    );
  }
```

- [ ] **Step 3: Replace error state**

Old (lines 229-258):
```tsx
if (error && !installUrl) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[var(--color-charcoal)]">Settings</h1>
        <div className="glass-card rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
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
                className="rounded-full bg-red-100 px-3 py-1 text-red-700 hover:bg-red-200"
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

New:
```tsx
if (error && !installUrl) {
    return (
      <div className="space-y-4">
        <h1 className="text-headline-xl font-bold text-on-surface">Settings</h1>
        <div className="bg-error-container/20 border border-error/30 rounded-xl px-4 py-3 text-sm text-error">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-error underline hover:opacity-80"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  fetchData();
                }}
                className="rounded-full bg-error/20 px-3 py-1 text-error hover:bg-error/30"
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

- [ ] **Step 4: Replace the entire return block**

Old (lines 261-537):
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

      {/* Organization */}
      <section className="glass-panel rounded-2xl p-6">
        ...
      </section>

      {/* Team Roles (admin only) */}
      {isAdmin && (
        <section className="glass-panel rounded-2xl p-6">
          ...
        </section>
      )}

      {/* GitHub Integration */}
      <IntegrationCard title="GitHub Integration" ... >
        ...
      </IntegrationCard>

      {/* Slack Integration */}
      <IntegrationCard title="Slack Integration" ... >
        ...
      </IntegrationCard>

      {/* Discord Integration */}
      <IntegrationCard title="Discord Integration" ... >
        ...
      </IntegrationCard>
    </div>
  );
```

New (replace entire return):
```tsx
  const connectedCount = [installations.length > 0, slackInstallations.length > 0, discordStatus?.connected === true].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header + Global Status */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-headline-xl text-on-surface mb-2">Integrations</h1>
          <p className="text-on-surface-variant text-body-md max-w-xl">
            Synchronize your ecosystem. Our agents weave through your connected tools to craft
            context-aware documentation in real-time.
          </p>
        </div>
        <GlobalStatusCard sourceCount={connectedCount} />
      </div>

      {/* Error banner (when we have data but there's a non-fatal error) */}
      {error && (
        <div className="bg-error-container/20 border border-error/30 rounded-xl px-4 py-3 text-sm text-error flex items-center justify-between">
          <span>{error}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setError(null)} className="underline hover:opacity-80">
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => { setError(null); fetchData(); }}
              className="rounded-full bg-error/20 px-3 py-1 hover:bg-error/30"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* GitHub */}
        <SettingsCard
          icon={
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          }
          title="GitHub"
          description="Connect Draftly to your GitHub repositories to automatically generate documentation from issues."
          id="GHUB-PR-WATCH"
          connected={installations.length > 0}
          features={[
            { label: "Auto-Ingest", sublabel: "Sync on PR merge", enabled: installations.length > 0 },
            { label: "Codebase Scan", sublabel: "Weekly structure update", enabled: false },
          ]}
          actionLabel={installations.length > 0 ? "Manage Repositories" : "Install GitHub App"}
          onAction={() => {
            if (installUrl?.install_url) {
              window.open(installUrl.install_url, "_blank", "noopener,noreferrer");
            }
          }}
        >
          {installations.length > 0 && (
            <div className="space-y-2">
              {installations.map((inst) => (
                <div key={inst.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-on-surface">{inst.github_org}</span>
                    <span className="text-[10px] font-mono bg-secondary-container/30 text-secondary px-2 py-0.5 rounded-full">
                      Connected
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {Array.isArray(inst.repositories) ? inst.repositories.length : 0}{" "}
                    {Array.isArray(inst.repositories) && inst.repositories.length === 1 ? "repository" : "repositories"}{" "}
                    accessible
                  </p>
                  {Array.isArray(inst.repositories) && inst.repositories.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {inst.repositories.map((repo) => (
                        <span
                          key={repo.full_name}
                          className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant"
                        >
                          {repo.full_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SettingsCard>

        {/* Slack */}
        <SettingsCard
          icon={
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.522h-6.313z" />
            </svg>
          }
          title="Slack"
          description="Connect Draftly to your Slack workspace to automatically generate documentation from support requests."
          id="SLK-882-ING"
          connected={slackInstallations.length > 0}
          features={[
            { label: "Auto-Ingest", sublabel: "Analyze new threads hourly", enabled: slackInstallations.length > 0 },
            { label: "Channel Monitoring", sublabel: "Real-time update pings", enabled: slackInstallations.length > 0 },
          ]}
          actionLabel={slackInstallations.length > 0 ? "Configure Channels" : "Connect Slack Workspace"}
          onAction={() => {
            if (slackInstallUrl) {
              window.open(slackInstallUrl, "_blank", "noopener,noreferrer");
            }
          }}
        >
          {slackInstallations.length > 0 && (
            <div className="space-y-2">
              {slackInstallations.map((inst) => (
                <div key={inst.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-on-surface">{inst.team_name}</span>
                    <span className="text-[10px] font-mono bg-secondary-container/30 text-secondary px-2 py-0.5 rounded-full">
                      Connected
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">Bot ID: {inst.bot_user_id}</p>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>

        {/* Discord */}
        <SettingsCard
          icon={
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
            </svg>
          }
          title="Discord"
          description="Connect Draftly to your Discord server to automatically generate documentation from support requests."
          id="DSC-COMM-1"
          connected={discordStatus?.connected === true}
          features={[
            { label: "Auto-Ingest", sublabel: discordStatus?.connected ? "Active" : "Requires Auth", enabled: discordStatus?.connected === true },
          ]}
          actionLabel={discordStatus?.connected ? "Configure Channels" : "Connect Discord Server"}
          onAction={() => {
            if (!discordStatus?.connected) {
              if (discordInviteUrl?.invite_url) {
                window.open(discordInviteUrl.invite_url, "_blank", "noopener,noreferrer");
              }
            }
          }}
        >
          {discordStatus?.connected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-on-surface">Guild: {discordStatus.guild_id}</span>
                <span className="text-[10px] font-mono bg-secondary-container/30 text-secondary px-2 py-0.5 rounded-full">Connected</span>
              </div>

              {/* Trigger Channels */}
              <div>
                <h4 className="text-sm font-semibold text-on-surface mb-1">Trigger Channels</h4>
                <p className="text-xs text-on-surface-variant mb-2">
                  Select channels where the bot responds to @mentions.
                  {triggerSaving && <span className="ml-2 text-secondary">Saving...</span>}
                </p>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-outline-variant bg-surface-variant/20 p-2 scrollbar-thin">
                  {availableChannels.length === 0 ? (
                    <p className="text-xs text-on-surface-variant">No channels found</p>
                  ) : (
                    availableChannels.map((ch) => (
                      <label
                        key={ch.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface-variant/40"
                      >
                        <input
                          type="checkbox"
                          checked={triggerChannelIds.includes(ch.id)}
                          onChange={() => handleToggleChannel(ch.id)}
                          disabled={triggerSaving}
                          className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary bg-surface-variant"
                        />
                        <span className="text-on-surface">#{ch.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>


            </div>
          )}
        </SettingsCard>

        {/* Request Integration Placeholder */}
        <div className="border-2 border-dashed border-outline-variant hover:border-primary/50 transition-all duration-300 rounded-xl flex flex-col items-center justify-center p-8 gap-4 cursor-pointer min-h-[300px]">
          <div className="w-16 h-16 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg className="w-8 h-8 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-on-surface font-bold text-lg">Request Integration</h3>
            <p className="text-on-surface-variant text-sm mt-1">
              Don't see your tool? Suggest a new connection for the Draftly Engine.
            </p>
          </div>
        </div>
      </div>

      {/* Organization */}
      <section className="bg-surface-container border border-outline-variant rounded-xl p-6">
        <h2 className="font-bold text-lg text-on-surface">Organization</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Switch between organizations or manage team settings.
        </p>
        <div className="mt-4">
          <OrganizationSwitcher />
        </div>
        {organization && (
          <div className="mt-4 text-sm text-on-surface-variant">
            <p>
              Active: <strong className="text-on-surface">{organization.name}</strong>
              {membership && (
                <span>
                  {" "}— Role: <strong className="text-on-surface">{membership.role}</strong>
                </span>
              )}
            </p>
          </div>
        )}
      </section>

      {/* Team Roles (admin only) */}
      {isAdmin && (
        <section className="bg-surface-container border border-outline-variant rounded-xl p-6">
          <h2 className="font-bold text-lg text-on-surface">Team Roles</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Assign roles to organization members. Members with the <strong>Reviewer</strong>{" "}
            role can register themselves as reviewers for documentation.
          </p>

          {members.length > 0 ? (
            <div className="mt-4 divide-y divide-outline-variant/30">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-on-surface">{member.email}</p>
                    <p className="text-xs text-on-surface-variant">ID: {member.user_id}</p>
                  </div>
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                    disabled={roleLoading === member.user_id}
                    className="rounded-xl border border-outline-variant bg-surface-variant/30 px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-50"
                  >
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
            <p className="mt-4 text-sm text-on-surface-variant">No organization members found.</p>
          )}
        </section>
      )}

        {/* Discord Guild ID Input (shown after invite URL is fetched but not connected yet) */}
      {discordInviteUrl && discordStatus?.connected !== true && (
        <section className="bg-surface-container border border-outline-variant rounded-xl p-6">
          <h2 className="font-bold text-lg text-on-surface">Link Discord Server</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Paste the server ID after adding the Draftly bot to your server.
          </p>
          <div className="mt-4 flex items-end gap-2 max-w-md">
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={guildIdInput}
                onChange={(e) => setGuildIdInput(e.target.value)}
                placeholder="e.g. 123456789012345678"
                className="mt-1 block w-full rounded-xl border border-outline-variant bg-surface-variant/20 px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-on-surface-variant">
                Right-click your server name in Discord → Copy Server ID
              </p>
            </div>
            <button
              type="button"
              onClick={handleDiscordLink}
              disabled={discordLinking || !guildIdInput.trim()}
              className="shrink-0 rounded-full bg-primary text-on-primary px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {discordLinking ? "Connecting..." : "Connect"}
            </button>
          </div>
        </section>
      )}

      {/* Live Agent Log Stream */}
      <LogStream />
    </div>
  );
```

- [ ] **Step 5: Verify the page compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No type errors.

---

### Task 6: Verification

- [ ] **Step 1: Run linter**

```bash
cd frontend && npx tsc --noEmit --pretty
```
Expected: No errors.

- [ ] **Step 2: Build to confirm no runtime issues**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: Build succeeds.

- [ ] **Step 3: Remove IntegrationCard import if unused elsewhere** (already confirmed it's only used in Settings.tsx, so no action needed — the component file stays but is no longer imported)

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-07-31-settings-stitch-redesign.md frontend/src/index.css frontend/src/components/SettingsCard.tsx frontend/src/components/GlobalStatusCard.tsx frontend/src/components/LogStream.tsx frontend/src/pages/Settings.tsx
git commit -m "feat: restyle Settings page to match stitch design mockup
- Add typography scale tokens to @theme (headline-xl, body-md, code-md, label-sm)
- Create SettingsCard bento-grid component with toggle switches and footer actions
- Create GlobalStatusCard matching mockup header status card
- Create LogStream terminal-style log viewer
- Rewrite Settings.tsx with bento grid layout, surface-layer tokens, preserved
  Organization/Team Roles sections"
```
