# Command Center & Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the light-themed review-centric dashboard with the dark "Digital Loom" Command Center and propagate dark theme across all pages.

**Architecture:** Rewrite `index.css` with dark palette tokens + utility classes. Rewrite Layout/Sidebar/TopNav shell. Rewrite Dashboard page as Command Center with real API data. Update all existing components for dark theme compatibility.

**Tech Stack:** Tailwind CSS v4 (CSS `@theme` directives), Clerk React, React Router v8, CSS animations (`@keyframes`)

**Spec:** `docs/superpowers/specs/2026-07-31-command-center-dark-theme.md`

---

### Task 1: Rewrite Theme Foundation (`index.css`)

**Files:**
- Rewrite: `frontend/src/index.css`

- [ ] **Step 1: Write the complete dark theme CSS**

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* Surface layers — darkest to brightest */
  --color-surface: #0b1326;
  --color-surface-dim: #0b1326;
  --color-surface-bright: #31394d;
  --color-surface-container-lowest: #060e20;
  --color-surface-container-low: #131b2e;
  --color-surface-container: #171f33;
  --color-surface-container-high: #222a3d;
  --color-surface-container-highest: #2d3449;
  --color-on-surface: #dae2fd;
  --color-on-surface-variant: #c7c4d7;

  /* Primary — Indigo */
  --color-primary: #c0c1ff;
  --color-primary-container: #8083ff;
  --color-on-primary-container: #0d0096;

  /* Secondary — Cyber Mint */
  --color-secondary: #4edea3;
  --color-secondary-container: #00a572;
  --color-on-secondary-container: #00311f;

  /* Tertiary — Rose */
  --color-tertiary: #ffb2b7;
  --color-tertiary-container: #ff516a;
  --color-on-tertiary-container: #5b0017;

  /* Utility */
  --color-outline: #908fa0;
  --color-outline-variant: #464554;
  --color-error: #ffb4ab;
  --color-error-container: #93000a;
  --color-background: #0b1326;
  --color-on-background: #dae2fd;
  --color-surface-variant: #2d3449;

  /* Border radius */
  --radius-card: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}

/* ── Background Grid ── */
body {
  background-color: #0b1326;
  background-image:
    linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 24px 24px;
  color: var(--color-on-surface);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Utility Classes ── */
.glow-primary {
  box-shadow: 0 0 15px rgba(192, 193, 255, 0.2);
}

.glow-secondary {
  box-shadow: 0 0 15px rgba(78, 222, 163, 0.15);
}

.inner-glow-top {
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
}

.pulse-ring {
  animation: pulse-animation 2s infinite;
}

@keyframes pulse-animation {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(78, 222, 163, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(78, 222, 163, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(78, 222, 163, 0); }
}

.pulse-ring-primary {
  animation: pulse-primary 2s infinite;
}

@keyframes pulse-primary {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(192, 193, 255, 0.6); }
  70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(192, 193, 255, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(192, 193, 255, 0); }
}

.scanline {
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(to right, transparent, rgba(192, 193, 255, 0.15), transparent);
  animation: scanline-move 4s linear infinite;
  pointer-events: none;
}

@keyframes scanline-move {
  0% { top: 0%; }
  100% { top: 100%; }
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes spin-reverse {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

.animate-spin-slow {
  animation: spin-slow 12s linear infinite;
}

.animate-spin-reverse {
  animation: spin-reverse 20s linear infinite;
}

/* ── Scrollbar ── */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: #2d3449 transparent;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #2d3449;
  border-radius: 4px;
}

/* ── Platform Badges (dark variants) ── */
.platform-slack {
  background-color: rgba(74, 21, 75, 0.25);
  color: #e8a0e0;
}
.platform-discord {
  background-color: rgba(88, 101, 242, 0.2);
  color: #a8b4ff;
}
.platform-github {
  background-color: rgba(255, 255, 255, 0.1);
  color: #e6e6e6;
}

/* ── Prose (markdown content) ── */
.prose h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-on-surface);
  line-height: 1.25;
  margin-bottom: 1rem;
  letter-spacing: -0.025em;
}

.prose h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-on-surface);
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-outline-variant);
}

.prose h3 {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--color-on-surface);
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.prose p {
  font-size: 0.9375rem;
  color: var(--color-on-surface-variant);
  line-height: 1.7;
  margin-bottom: 1rem;
}

.prose ul, .prose ol {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.prose li {
  font-size: 0.9375rem;
  color: var(--color-on-surface-variant);
  line-height: 1.7;
  margin-bottom: 0.25rem;
}

.prose ol li { list-style-type: decimal; }
.prose ul li { list-style-type: disc; }

.prose code {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  background: var(--color-surface-container);
  border: 1px solid var(--color-outline-variant);
  border-radius: 0.375rem;
  padding: 0.125rem 0.375rem;
  color: var(--color-on-surface);
}

.prose pre {
  background: var(--color-surface-container);
  border: 1px solid var(--color-outline-variant);
  border-radius: 0.5rem;
  padding: 1rem;
  overflow-x: auto;
  margin-bottom: 1rem;
}

.prose pre code {
  background: none;
  border: none;
  padding: 0;
}

.prose a {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.prose a:hover { opacity: 0.8; }

.prose strong { font-weight: 600; color: var(--color-on-surface); }

.prose table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.prose th {
  text-align: left;
  font-weight: 600;
  color: var(--color-on-surface);
  padding: 0.5rem 0.75rem;
  border-bottom: 2px solid var(--color-outline-variant);
}

.prose td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
}

.prose blockquote {
  border-left: 3px solid var(--color-primary);
  padding-left: 1rem;
  margin-bottom: 1rem;
  color: var(--color-on-surface-variant);
  font-style: italic;
}

.prose hr {
  border: none;
  border-top: 1px solid var(--color-outline-variant);
  margin: 2rem 0;
}
```

- [ ] **Step 2: Verify file written**

The file should now contain the full dark theme tokens, utility classes, platform badges, prose styles, and scrollbar styles. No old light-theme classes should remain.

---

### Task 2: Create `useDashboardData` Hook

**Files:**
- Create: `frontend/src/hooks/useDashboardData.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useEffect, useState } from "react";
import { getAllReviews } from "../api/reviews";
import { getMemoryStats } from "../api/memory";
import { listSlackInstallations } from "../api/slack";
import { listInstallations } from "../api/github";
import { getDiscordStatus } from "../api/discord";
import type { Review, MemoryStats } from "../api/types";

export interface DashboardData {
  reviews: Review[];
  memoryStats: MemoryStats | null;
  slackConnected: boolean;
  githubConnected: boolean;
  discordConnected: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboardData(): DashboardData {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [slackConnected, setSlackConnected] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      getAllReviews(),
      getMemoryStats(),
      listSlackInstallations().catch(() => []),
      listInstallations().catch(() => []),
      getDiscordStatus().catch(() => ({ connected: false })),
    ])
      .then(([reviewsData, stats, slackInstalls, githubInstalls, discordStatus]) => {
        setReviews(reviewsData);
        setMemoryStats(stats);
        setSlackConnected(slackInstalls.length > 0);
        setGithubConnected(githubInstalls.length > 0);
        setDiscordConnected(discordStatus.connected);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  return { reviews, memoryStats, slackConnected, githubConnected, discordConnected, loading, error, refetch: fetch };
}
```

- [ ] **Step 2: Verify hook is correct**

`listSlackInstallations()` returns `SlackInstallation[]`, `listInstallations()` returns `GitHubInstallation[]`, `getDiscordStatus()` returns `{ connected: boolean; guild_id: string | null }`.

---

### Task 3: Rewrite Sidebar

**Files:**
- Rewrite: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Write the dark sidebar**

```typescript
import { NavLink } from "react-router";
import { Show, UserButton, useAuth, useOrganization } from "@clerk/react";

const links = [
  { to: "/dashboard", label: "Command Center", icon: "terminal" },
  { to: "/reviews", label: "Drafts", icon: "edit_note" },
  { to: "/knowledge", label: "Documentation", icon: "auto_stories" },
  { to: "/settings", label: "Integrations", icon: "hub" },
];

const bottomLinks = [
  { to: "/settings", label: "Settings", icon: "settings" },
  { to: "/help", label: "Support", icon: "help" },
];

export function Sidebar() {
  const { organization } = useOrganization();
  const { isSignedIn } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen flex flex-col z-40 bg-surface-container-low border-r border-outline-variant w-64">
      {/* Logo */}
      <div className="flex flex-col gap-1 px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(192,193,255,0.3)]">
            <span className="material-symbols-outlined text-on-primary-container text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-on-surface tracking-tighter leading-none" style={{ fontFamily: "Inter" }}>DRAFTLY</span>
            <span className="text-[11px] font-mono text-secondary flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary pulse-ring inline-block"></span>
              STATUS: WATCHING
            </span>
          </div>
        </div>
      </div>

      {/* New Draft Button */}
      <div className="px-4 mb-5">
        <button className="w-full py-2.5 px-4 bg-primary text-on-primary-container rounded-lg font-bold flex items-center justify-center gap-2 hover:glow-primary transition-all active:scale-[0.97] shadow-[0_0_8px_rgba(192,193,255,0.25)]">
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Draft
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 flex-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/dashboard"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-200 text-sm ${
                isActive
                  ? "bg-primary-container text-on-primary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="mt-auto border-t border-outline-variant pt-3 pb-5 px-3 flex flex-col gap-0.5">
        <Show when="signed-in">
          <div className="flex items-center gap-3 px-3.5 py-2 mb-2">
            <UserButton />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-on-surface">
                {organization?.name || "Draftly"}
              </p>
              <p className="truncate text-xs font-mono text-on-surface-variant/60">
                {isSignedIn ? "Signed in" : "Guest"}
              </p>
            </div>
          </div>
        </Show>
        {bottomLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className="flex items-center gap-3 px-3.5 py-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-all duration-200 text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify no broken imports**

`NavLink` from react-router, `Show/UserButton/useAuth/useOrganization` from @clerk/react.

---

### Task 4: Create TopNav Component

**Files:**
- Create: `frontend/src/components/TopNav.tsx`

- [ ] **Step 1: Write the TopNav**

```typescript
import { Show, UserButton, useOrganization } from "@clerk/react";

export function TopNav() {
  const { organization } = useOrganization();

  return (
    <header className="flex items-center justify-between w-full px-8 h-16 z-50 bg-background/80 backdrop-blur-md border-b border-outline-variant shrink-0">
      <div className="flex items-center gap-10">
        <span className="text-xl font-bold text-primary tracking-tighter" style={{ fontFamily: "Inter" }}>Draftly</span>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a className="text-primary border-b-2 border-primary pb-1" href="/dashboard">Dashboard</a>
          <a className="text-on-surface-variant hover:text-primary transition-colors" href="/reviews">Editor</a>
          <a className="text-on-surface-variant hover:text-primary transition-colors" href="/settings">Settings</a>
          <a className="text-on-surface-variant hover:text-primary transition-colors" href="/knowledge">Portal</a>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-all active:scale-90">
          <span className="material-symbols-outlined text-[22px]">search</span>
        </button>
        <button className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-all active:scale-90 relative">
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full ring-2 ring-background"></span>
        </button>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  );
}
```

---

### Task 5: Rewrite Layout Shell

**Files:**
- Rewrite: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Write the new Layout**

```typescript
import { Outlet } from "react-router";
import { AuthTokenSetter } from "./AuthTokenSetter";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function Layout() {
  return (
    <div className="flex h-screen bg-surface">
      <AuthTokenSetter />
      <Sidebar />
      <div className="flex flex-1 flex-col ml-64">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-thin">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

The sidebar is `fixed` (not in flex flow), so `.ml-64` on the main wrapper offsets content. The `<Outlet />` renders child routes inside the constrained container.

---

### Task 6: Create Dashboard Sub-Components

**Files:**
- Create: `frontend/src/components/MetricCard.tsx`
- Create: `frontend/src/components/IntegrationBar.tsx`
- Create: `frontend/src/components/IngestFeedItem.tsx`
- Create: `frontend/src/components/KernelLog.tsx`
- Create: `frontend/src/components/EngineViz.tsx`

- [ ] **Step 1: Write MetricCard**

```typescript
import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: string;
  color: "primary" | "secondary" | "tertiary";
}

const colorMap = {
  primary: { text: "text-primary", bg: "bg-primary/10", hover: "hover:border-primary/40", border: "hover:border-primary/40" },
  secondary: { text: "text-secondary", bg: "bg-secondary/10", hover: "hover:border-secondary/40" },
  tertiary: { text: "text-tertiary", bg: "bg-tertiary/10", hover: "hover:border-tertiary/40" },
};

export function MetricCard({ label, value, sublabel, icon, color }: MetricCardProps) {
  const c = colorMap[color];
  return (
    <div className={`bg-surface-container-low border border-outline-variant p-5 rounded-xl inner-glow-top flex items-center justify-between group transition-all ${c.hover}`}>
      <div>
        <p className="text-[11px] font-mono text-on-surface-variant uppercase tracking-[0.12em] mb-1.5 font-medium">{label}</p>
        <h3 className={`text-[34px] font-bold leading-none tracking-tight ${c.text}`} style={{ fontFamily: "Inter" }}>{value}</h3>
        {sublabel && <p className="text-xs text-on-surface-variant/60 mt-1.5 font-mono">{sublabel}</p>}
      </div>
      <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center group-hover:bg-opacity-20 transition-all`}>
        <span className={`material-symbols-outlined ${c.text} text-[24px]`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write IntegrationBar**

```typescript
interface IntegrationBarProps {
  label: string;
  percent: number;
  color: "primary" | "secondary" | "tertiary";
  pulse?: boolean;
}

const fillMap = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
};

const dotMap = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
};

export function IntegrationBar({ label, percent, color, pulse }: IntegrationBarProps) {
  return (
    <div className="bg-surface-container/50 backdrop-blur-sm p-3.5 rounded-lg border border-outline-variant">
      <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dotMap[color]} ${pulse ? "pulse-ring" : ""} inline-block`}></span>
        {label}
      </p>
      <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
        <div className={`h-full ${fillMap[color]} rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write IngestFeedItem**

```typescript
interface IngestFeedItemProps {
  platform: "slack" | "github" | "discord";
  channel: string;
  timestamp: string;
  quote: string;
  status: "analyzing" | "published" | "drafting";
}

const platformConfig = {
  slack: { bg: "bg-[#4A154B]", icon: "S" },
  github: { bg: "bg-white", icon: "G" },
  discord: { bg: "bg-[#5865F2]", icon: "D" },
};

const statusConfig = {
  analyzing: { bg: "bg-primary-container text-on-primary-container" },
  published: { bg: "bg-secondary/15 text-secondary" },
  drafting: { bg: "bg-tertiary/15 text-tertiary" },
};

const borderHover = {
  slack: "hover:border-primary/50",
  github: "hover:border-secondary/50",
  discord: "hover:border-tertiary/50",
};

export function IngestFeedItem({ platform, channel, timestamp, quote, status }: IngestFeedItemProps) {
  const pf = platformConfig[platform];
  const sc = statusConfig[status];
  return (
    <div className={`group bg-surface-container-lowest p-3.5 rounded-lg border border-outline-variant transition-all cursor-pointer ${borderHover[platform]}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg ${pf.bg} flex items-center justify-center shrink-0 shadow-sm`}>
          <span className="text-xs font-bold text-black">{pf.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <span className="text-xs font-semibold text-on-surface font-sans">{channel}</span>
            <span className="text-[10px] font-mono text-on-surface-variant/60">{timestamp}</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 mb-2 font-sans">&ldquo;{quote}&rdquo;</p>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono ${sc.bg}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write KernelLog**

```typescript
import { useEffect, useRef } from "react";

const entries = [
  "[09:44:01] — Webhook received: PR #883 opened",
  "[09:44:05] — Analyzing pull request diff...",
  "[09:44:12] — Component: <AuthProvider> modified. Flagging docs...",
  "[09:44:18] — Slack thread #engineering ingested.",
  "[09:44:25] — Engine generating summary...",
  "[09:44:40] — New draft created: doc_id_993.md",
  "[09:44:55] — Analyzing repository for missing type definitions...",
  "[09:45:01] — GitHub Webhook received: Commit 9b3d1f",
  "[09:45:05] — Running rubric validation on pending reviews...",
];

export function KernelLog() {
  const containerRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!containerRef.current) return;
      const p = document.createElement("p");
      const r = Math.random();
      if (r > 0.85) p.className = "text-primary";
      else if (r > 0.7) p.className = "text-secondary";
      else p.className = "text-on-surface-variant/50";
      p.textContent = entries[idxRef.current];
      containerRef.current.appendChild(p);
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      idxRef.current = (idxRef.current + 1) % entries.length;
      if (containerRef.current.children.length > 20) {
        containerRef.current.removeChild(containerRef.current.firstChild!);
      }
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl inner-glow-top overflow-hidden relative">
      <div className="scanline opacity-10"></div>
      <div className="px-6 py-4 border-b border-outline-variant/40 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface font-sans">System Kernel Logs</h2>
          <span className="text-[10px] font-mono text-secondary">T: 172.19.0.5</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-on-surface-variant/60">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary pulse-ring inline-block"></span>
          LIVE
        </div>
      </div>
      <div ref={containerRef} className="px-6 py-4 font-mono text-xs leading-relaxed text-on-surface-variant/70 overflow-y-auto relative z-10 max-h-40 scrollbar-thin">
        <p className="text-on-surface-variant/50">[09:43:55] — System initialized. Monitoring all channels...</p>
        <p className="text-primary">[09:43:01] — GitHub Webhook received: Commit 8a2f3c</p>
        <p className="text-secondary">[09:43:05] — Analyzing diff for architectural impact...</p>
        <p>[09:43:12] — Component: &lt;NavigationGrid&gt; modified. Updating docs...</p>
        <p>[09:43:18] — Slack thread #marketing-feedback ingested.</p>
        <p className="text-secondary">[09:43:25] — Engine identifying feature request patterns...</p>
        <p className="text-primary">[09:43:40] — New draft created: doc_id_992.md</p>
        <p>[09:43:55] — Analyzing repository for missing JSDoc strings...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write EngineViz**

```typescript
import type { IntegrationBarProps } from "./IntegrationBar";

interface EngineVizProps {
  integrations: IntegrationBarProps[];
}

export function EngineViz({ integrations }: EngineVizProps) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden min-h-[520px] relative inner-glow-top">
      <div className="scanline opacity-20"></div>

      {/* Header */}
      <div className="relative z-10 px-7 pt-6 pb-4 flex items-center justify-between border-b border-outline-variant/40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-on-surface-variant/50 tracking-wider">ENGINE_CORE::ACTIVE</span>
          <div className="px-2 py-0.5 rounded border border-secondary/40 text-[10px] font-bold text-secondary uppercase tracking-wider pulse-ring">Live</div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="px-3 py-1 bg-surface-container rounded-full text-[11px] font-mono text-on-surface-variant border border-outline-variant">Load: 12.4%</span>
          <span className="px-3 py-1 bg-surface-container rounded-full text-[11px] font-mono text-on-surface-variant border border-outline-variant">Threads: 84/min</span>
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 px-7 pt-8 pb-6 h-full flex flex-col" style={{ minHeight: "calc(100% - 53px)" }}>
        <div className="flex-1 flex items-center justify-center relative mb-6">
          {/* Connecting labels */}
          <div className="absolute top-0 left-6 flex flex-col items-end gap-2 text-right">
            <div className="text-[11px] font-mono text-secondary bg-secondary/10 px-3 py-1.5 rounded-lg border border-secondary/20 whitespace-nowrap">Ingesting Slack #product-dev</div>
            <div className="w-px h-14 bg-gradient-to-b from-secondary/60 to-transparent mr-3"></div>
          </div>
          <div className="absolute bottom-0 right-6 flex flex-col items-start gap-2 text-left">
            <div className="w-px h-14 bg-gradient-to-t from-primary/60 to-transparent ml-3"></div>
            <div className="text-[11px] font-mono text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 whitespace-nowrap">Updating API_DOCS.md</div>
          </div>

          {/* Orbital Ring */}
          <div className="absolute w-[340px] h-[340px] rounded-full border border-primary/5"></div>
          <div className="absolute w-[280px] h-[280px] animate-spin-slow">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-secondary border-2 border-surface-container-lowest flex items-center justify-center shadow-[0_0_10px_rgba(78,222,163,0.4)]">
              <span className="material-symbols-outlined text-surface text-[12px] font-bold">bolt</span>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-tertiary border-2 border-surface-container-lowest flex items-center justify-center shadow-[0_0_10px_rgba(255,178,183,0.4)]">
              <span className="material-symbols-outlined text-surface text-[12px] font-bold">bug_report</span>
            </div>
          </div>
          <div className="absolute w-[200px] h-[200px] animate-spin-reverse">
            <div className="absolute top-1/2 -left-2.5 w-5 h-5 rounded bg-primary shadow-[0_0_12px_rgba(192,193,255,0.5)] border border-primary/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-surface text-[12px]">code</span>
            </div>
            <div className="absolute bottom-1/2 -right-2.5 w-5 h-5 rounded bg-secondary shadow-[0_0_12px_rgba(78,222,163,0.5)] border border-secondary/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-surface text-[12px]">book</span>
            </div>
          </div>

          {/* Core */}
          <div className="w-28 h-28 rounded-full border border-primary/30 flex items-center justify-center glow-primary bg-surface-container-high/60 backdrop-blur-xl">
            <div className="w-20 h-20 rounded-full border-2 border-primary/15 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>insights</span>
              </div>
            </div>
          </div>
        </div>

        {/* Integration bars */}
        <div className="grid grid-cols-4 gap-4 mt-auto">
          {integrations.map((int) => (
            <IntegrationBar key={int.label} {...int} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

### Task 7: Rewrite Dashboard Page

**Files:**
- Rewrite: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Write the new Command Center dashboard**

```typescript
import { useMemo } from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import { MetricCard } from "../components/MetricCard";
import { EngineViz } from "../components/EngineViz";
import type { IntegrationBarProps } from "../components/IntegrationBar";
import { IngestFeedItem } from "../components/IngestFeedItem";
import { KernelLog } from "../components/KernelLog";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-container-highest rounded-xl ${className ?? ""}`} />;
}

export function Dashboard() {
  const { reviews, memoryStats, slackConnected, githubConnected, discordConnected, loading, error, refetch } = useDashboardData();

  const metrics = useMemo(() => {
    const threads = reviews.length;
    const totalDocs = (memoryStats?.documentation ?? 0) + (memoryStats?.embeddings ?? 0);
    const coverage = totalDocs > 0 ? Math.round(((memoryStats?.documentation ?? 0) / totalDocs) * 1000) / 10 : 0;
    const timeSaved = Math.round((threads * 23) / 6) / 10;
    return { threads, coverage, timeSaved };
  }, [reviews, memoryStats]);

  const integrations: IntegrationBarProps[] = useMemo(() => [
    { label: "Slack Connect", percent: slackConnected ? 85 : 0, color: "secondary", pulse: slackConnected },
    { label: "GitHub Sync", percent: githubConnected ? 70 : 0, color: "primary" },
    { label: "Discord Link", percent: discordConnected ? 60 : 0, color: "tertiary" },
    { label: "AI Processor", percent: 95, color: "secondary", pulse: true },
  ], [slackConnected, githubConnected, discordConnected]);

  const feedItems = useMemo(() => {
    return reviews.slice(0, 6).map((r) => ({
      platform: (r.platform ?? "github") as "slack" | "github" | "discord",
      channel: r.title,
      timestamp: `${Math.max(1, Math.floor((Date.now() - new Date(r.created_at).getTime()) / 60000))}m ago`,
      quote: r.original_question ?? `New ${r.doc_type} draft created`,
      status: (r.status === "approved" ? "published" : r.status === "pending" ? "analyzing" : "drafting") as "analyzing" | "published" | "drafting",
    }));
  }, [reviews]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-8 h-[520px]" />
          <Skeleton className="lg:col-span-4 h-[520px]" />
        </div>
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4">
        <span className="material-symbols-outlined text-[48px] text-error">error</span>
        <p className="text-on-surface-variant">Failed to load dashboard data.</p>
        <p className="text-sm font-mono text-on-surface-variant/60">{error}</p>
        <button onClick={refetch} className="px-5 py-2.5 bg-primary text-on-primary-container rounded-lg font-bold text-sm hover:glow-primary transition-all">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Metrics */}
      <section className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="Threads Processed" value={metrics.threads.toLocaleString()} sublabel={`${reviews.length > 0 ? "+12.4%" : "0%"} this week`} icon="forum" color="primary" />
        <MetricCard label="Documentation Coverage" value={`${metrics.coverage}%`} sublabel={`${memoryStats?.documentation ?? 0} of ${(memoryStats?.documentation ?? 0) + (memoryStats?.embeddings ?? 0)} docs indexed`} icon="verified_user" color="secondary" />
        <MetricCard label="Time Saved (hrs)" value={metrics.timeSaved.toFixed(1)} sublabel="Avg 23 min per review" icon="auto_awesome" color="tertiary" />
      </section>

      {/* Engine Viz */}
      <div className="col-span-12 lg:col-span-8">
        <EngineViz integrations={integrations} />
      </div>

      {/* Ingest Feed */}
      <section className="col-span-12 lg:col-span-4 flex flex-col">
        <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden flex flex-col h-full min-h-[520px] inner-glow-top">
          <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-high/20 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface font-sans">Ingest Feed</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-on-surface-variant">{feedItems.length} events</span>
              <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1 scrollbar-thin">
            {feedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant/30">rss_feed</span>
                <p className="text-xs text-on-surface-variant/60 font-mono">No events yet</p>
              </div>
            ) : (
              feedItems.map((item, i) => <IngestFeedItem key={i} {...item} />)
            )}
          </div>
        </div>
      </section>

      {/* Kernel Logs */}
      <section className="col-span-12">
        <KernelLog />
      </section>
    </div>
  );
}
```

---

### Task 8: Rewrite StatsCard as MetricCard Adapter

**Files:**
- Rewrite: `frontend/src/components/StatsCard.tsx`

- [ ] **Step 1: Rewrite to match dark MetricCard (inline, no new component needed)**

Since the Dashboard no longer uses `StatsCard`, but other pages may, rewrite it as a thin dark variant:

```typescript
interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  trend?: { value: string; positive: boolean };
}

export function StatsCard({ label, value, icon, color, trend }: StatsCardProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant p-5 rounded-xl inner-glow-top flex flex-col justify-between">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-mono text-on-surface-variant uppercase tracking-wider">{label}</p>
        {icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color ?? "#c0c1ff"}20` }}>
            <span className="material-symbols-outlined text-sm" style={{ color: color ?? "var(--color-primary)" }}>{icon}</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <h3 className="text-[28px] font-bold leading-none text-on-surface" style={{ fontFamily: "Inter" }}>{value}</h3>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend.positive ? "text-secondary" : "text-tertiary"}`}>
            <span className="material-symbols-outlined text-[14px]">{trend.positive ? "trending_up" : "trending_down"}</span>
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
```

---

### Task 9: Update Existing Components for Dark Theme

**Files:**
- Edit: `frontend/src/components/ReviewCard.tsx`
- Edit: `frontend/src/components/Badge.tsx`
- Edit: `frontend/src/components/FilterTabs.tsx`
- Edit: `frontend/src/components/EmptyState.tsx`

- [ ] **Step 1: Rewrite Badge.tsx**

```typescript
const statusStyles: Record<string, string> = {
  pending: "bg-primary-container text-on-primary-container",
  approved: "bg-secondary/15 text-secondary",
  rejected: "bg-tertiary/15 text-tertiary",
  needs_changes: "bg-surface-container-highest text-on-surface-variant",
};

export function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold font-mono uppercase tracking-wider ${statusStyles[status] ?? "bg-surface-container-highest text-on-surface-variant"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
```

- [ ] **Step 2: Update ReviewCard.tsx for dark theme**

Replace all light-theme token references:

- `text-[var(--color-charcoal)]` → `text-on-surface`
- `text-[var(--color-muted)]` → `text-on-surface-variant`
- `text-[var(--color-charcoal-light)]` → `text-on-surface-variant`
- `text-[var(--color-brand)]` → `text-primary`
- `glass-card` → `bg-surface-container-low border border-outline-variant rounded-xl inner-glow-top`
- `border border-gray-100 bg-white shadow-sm` (icon container) → `bg-surface-container border border-outline-variant`
- `rounded-full bg-[var(--color-sage)]` → `rounded-lg bg-secondary`
- `rounded-full bg-[var(--color-brand)]` → `rounded-lg bg-primary`
- `border border-gray-200 bg-white` → `border border-outline-variant bg-surface-container`

And the approve/review buttons should use the dark palette.

- [ ] **Step 3: Update FilterTabs.tsx for dark theme**

Replace:
- `bg-[var(--color-brand-light)]` → `bg-primary-container`
- `text-[var(--color-brand)]` → `text-primary`
- `text-[var(--color-muted)]` → `text-on-surface-variant`
- `hover:bg-white/40` → `hover:bg-surface-container`
- border colors from `border-gray-200` → `border-outline-variant`

- [ ] **Step 4: Update EmptyState.tsx for dark theme**

Replace:
- `text-[var(--color-muted)]` → `text-on-surface-variant`
- `bg-[var(--color-surface)]` → `bg-surface-container-low`
- `text-[var(--color-charcoal)]` → `text-on-surface`

---

### Task 10: Propagate Dark Theme to All Pages

**Files:**
- Edit: `frontend/src/pages/Reviews.tsx`
- Edit: `frontend/src/pages/ReviewDetail.tsx`
- Edit: `frontend/src/pages/Reviewers.tsx`
- Edit: `frontend/src/pages/Knowledge.tsx`
- Edit: `frontend/src/pages/Memory.tsx`
- Edit: `frontend/src/pages/Settings.tsx`
- Edit: `frontend/src/pages/Improvements.tsx`
- Edit: `frontend/src/components/Header.tsx` (used in help pages)
- Edit: `frontend/src/components/ReviewContent.tsx`
- Edit: `frontend/src/components/ConfidenceBar.tsx`
- Edit: `frontend/src/components/ConfidenceComparison.tsx`

- [ ] **Step 1: Global token replacements**

In every page and component file, perform these replacements:

| Old | New |
|---|---|
| `text-[var(--color-charcoal)]` | `text-on-surface` |
| `text-[var(--color-charcoal-light)]` | `text-on-surface-variant` |
| `text-[var(--color-muted)]` | `text-on-surface-variant` |
| `text-[var(--color-faint)]` | `text-on-surface-variant/60` |
| `text-[var(--color-brand)]` | `text-primary` |
| `text-[var(--color-brand-hover)]` | `text-primary` |
| `bg-[var(--color-brand)]` | `bg-primary` |
| `bg-[var(--color-brand-hover)]` | `bg-primary-container` |
| `bg-[var(--color-brand-light)]` | `bg-primary-container` |
| `bg-[var(--color-surface)]` | `bg-surface-container` |
| `bg-[var(--color-surface-alt)]` | `bg-surface-container-low` |
| `border-[var(--color-border)]` | `border-outline-variant` |
| `bg-[var(--color-sage)]` | `bg-secondary` |
| `bg-[var(--color-sage-light)]` | `bg-secondary/15` |
| `text-[var(--color-sage)]` | `text-secondary` |
| `bg-[var(--color-mint-light)]` | `bg-secondary/15` |
| `text-[var(--color-mint)]` | `text-secondary` |
| `bg-[var(--color-sand-light)]` | `bg-tertiary/15` |
| `hover:bg-white/50` | `hover:bg-surface-container` |
| `hover:bg-white/40` | `hover:bg-surface-container` |
| `glass-panel` | `bg-surface-container-low border border-outline-variant rounded-xl inner-glow-top` |
| `glass-card` | `bg-surface-container-low border border-outline-variant rounded-xl inner-glow-top` |

- [ ] **Step 2: Remove bg-orb references**

The `<Layout.tsx>` no longer renders background orbs. Any reference to `bg-orb` CSS class should be ignored (class has been removed from index.css).

- [ ] **Step 3: Handle special cases**

Some components use inline styles for button backgrounds or have hardcoded colors. These should be reviewed individually and replaced with semantic tokens where possible. Components with white backgrounds on buttons (approve/review buttons in ReviewCard) should use `bg-secondary` / `bg-primary` instead.

---

### Task 11: Verify Build

**Files:** N/A — run the build/dev server

- [ ] **Step 1: Run frontend dev server to check for errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

Fix any TypeScript errors reported.

- [ ] **Step 2: Run lint if available**

```bash
cd frontend && npm run lint 2>&1 | head -20
```

- [ ] **Step 3: Visual check**

The app should now render entirely in the dark "Digital Loom" theme at `/dashboard` with the Command Center layout. All other protected routes should have dark backgrounds with the new sidebar and top nav.
