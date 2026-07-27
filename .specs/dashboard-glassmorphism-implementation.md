# Dashboard Glassmorphism — Implementation Plan

## Overview

Redesign the Draftly frontend with a glassmorphism aesthetic. **Removes the top Header bar** — logo, org badge, user button, and settings move into the Sidebar. 10 files modified (Header.tsx becomes unused), 1 HTML file updated. Estimated ~300 lines changed across all files.

## Preconditions

- TailwindCSS v4 with `@tailwindcss/vite` plugin (already in place)
- No component library — all custom (already the case)
- Node_modules installed (`cd frontend && npm install`)

---

## Step 1: Add Material Symbols font to HTML

**File: `frontend/index.html`**

Add Google Fonts preconnect + Material Symbols Outlined stylesheet link in `<head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
```

**Verify**: Run `npm run dev`, open browser console, check no 404 for the font. Type `span` with class `material-symbols-outlined` should render an icon.

---

## Step 2: Update CSS tokens and add glass utilities

**File: `frontend/src/index.css`**

### 2a: Add missing + new variables inside `@theme`

Add after existing tokens:

```css
--color-terracotta: #e07a5f;
--color-terracotta-light: #fdf0eb;

--radius-card: 16px;
--shadow-card: 0 4px 24px rgba(41, 47, 54, 0.08);
--shadow-card-hover: 0 8px 32px rgba(41, 47, 54, 0.12);
--text-heading: 1.5rem;

--color-glass: rgba(255, 255, 255, 0.65);
--color-glass-card: rgba(255, 255, 255, 0.5);
--color-glass-border: rgba(255, 255, 255, 0.8);

--color-mint: #4ECDC4;
--color-mint-light: rgba(78, 205, 196, 0.15);
```

### 2b: Add utility classes after `.prose hr`

```css
/* ── Glassmorphism ── */
.glass-panel {
  background-color: var(--color-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--color-glass-border);
  box-shadow: 0 12px 40px rgba(41, 47, 54, 0.08);
}

.glass-card {
  background-color: var(--color-glass-card);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  transition: all 0.3s ease;
}

.glass-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 1);
  background-color: rgba(255, 255, 255, 0.7);
  box-shadow: 0 16px 48px rgba(41, 47, 54, 0.12);
}

/* ── Background Orbs ── */
.bg-orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(120px);
  z-index: 0;
  opacity: 0.12;
  pointer-events: none;
}

/* ── Shimmer Loading ── */
.shimmer {
  position: relative;
  overflow: hidden;
}

.shimmer::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.4) 20%,
    rgba(255, 255, 255, 0.6) 60%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
```

**Verify**: `npm run dev`, inspect any card element — `.glass-card` class should produce translucent background with blur.

---

## Step 3: Update Layout — remove Header, add glass background and orbs

**File: `frontend/src/components/Layout.tsx`**

Replace the full file content. **Header is removed** — the sidebar now handles all top-level navigation:

```tsx
import { Outlet } from "react-router";
import { AuthTokenSetter } from "./AuthTokenSetter";
import { Sidebar } from "./Sidebar";

export function Layout() {
  return (
    <div
      className="flex h-screen"
      style={{ backgroundColor: "#F4F7FB" }}
    >
      <AuthTokenSetter />

      {/* Background orbs */}
      <div
        className="bg-orb"
        style={{
          width: 600,
          height: 600,
          background: "#4ECDC4",
          top: -100,
          left: -100,
        }}
      />
      <div
        className="bg-orb"
        style={{
          width: 700,
          height: 700,
          background: "#FF6B6B",
          bottom: -200,
          right: -100,
        }}
      />

      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
```

Key changes:
- **Removed**: `Header` import and `<Header />` component
- Background: inline `#F4F7FB` for the cool blue-gray base
- Two `.bg-orb` divs with mint (top-left) and coral (bottom-right)
- Layout is now a simple flex row: Sidebar + main content
- Main padding increased from `p-6` to `p-8` for breathing room

**Verify**: No header bar at top. Sidebar fills full height. Background has faint colored blurs.

---

## Step 4: Rewrite Sidebar — absorb Header elements + glass treatment

**File: `frontend/src/components/Sidebar.tsx`**

Replace the full file. The sidebar now contains: logo area (from old Header), nav links, settings link, and user profile (from old Header's UserButton):

```tsx
import { NavLink } from "react-router";
import { Show, SignInButton, UserButton, useAuth, useOrganization } from "@clerk/react";

const baseLinks = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/docs", label: "Documentation", icon: "description" },
  { to: "/knowledge", label: "Knowledge Base", icon: "library_books" },
  { to: "/memory", label: "Memory", icon: "memory" },
  { to: "/settings", label: "Settings", icon: "settings" },
  { to: "/help", label: "Help Center", icon: "help_center" },
];

const reviewerLinks = [
  { to: "/reviewers", label: "Reviewers", icon: "rate_review" },
];

export function Sidebar() {
  const { membership, organization } = useOrganization();
  const { isSignedIn } = useAuth();
  const role = membership?.role;
  const showReviewers = role === "org:admin" || role === "org:reviewer";

  const links = [...baseLinks, ...(showReviewers ? reviewerLinks : [])];

  return (
    <aside className="w-[280px] h-screen shrink-0 glass-panel border-r border-white/80 flex flex-col justify-between py-6 px-4 z-20">
      <div>
        {/* Logo area */}
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-mint)] flex items-center justify-center text-white shadow-lg">
            <span className="material-symbols-outlined text-2xl font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-[var(--color-charcoal)]">
              Draftly
            </h1>
            <p className="text-[10px] text-[var(--color-muted)] font-medium uppercase tracking-wider">
              AI Documentation
            </p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex flex-col gap-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/dashboard"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white/60 text-[var(--color-brand)] shadow-sm border border-white/80"
                    : "text-[var(--color-muted)] hover:bg-white/40 hover:text-[var(--color-charcoal)]"
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">
                {link.icon}
              </span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom: User Profile */}
      <div className="mt-4 pt-4 border-t border-white/40">
        <Show when="signed-in">
          <div className="flex items-center gap-3 px-2">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9 rounded-full border-2 border-white shadow-sm",
                },
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-charcoal)] truncate">
                {organization?.name || "Draftly"}
              </p>
              <p className="text-xs text-[var(--color-muted)] truncate">
                {isSignedIn ? "Signed in" : "Guest"}
              </p>
            </div>
          </div>
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="w-full rounded-xl bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-hover)] transition-colors">
              Sign In
            </button>
          </SignInButton>
        </Show>
      </div>
    </aside>
  );
}
```

Key changes from old Sidebar:
- **Width**: `w-56` → `w-[280px]` to match inspiration
- **Background**: `bg-[var(--color-surface)]` → `glass-panel`
- **Logo area**: Gradient icon + "Draftly" + "AI Documentation" subtitle (from inspiration)
- **Nav icons**: Material Symbols added to each link
- **Nav link style**: `rounded-xl`, active uses `bg-white/60`
- **User profile**: Clerk `UserButton` + org name at bottom (replaces old Header's user section)
- **Sign-in button**: Shows for signed-out users

**Verify**: Sidebar should be full-height glass panel with logo at top, nav in middle, user at bottom. No top header bar visible.

---

## Step 5: Rewrite StatsCard

**File: `frontend/src/components/StatsCard.tsx`**

Replace full file. Adds `icon`, `color`, and `trend` props. Uses glass-card with fixed height and Material Symbols icon in a tinted circle:

```tsx
interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  trend?: { value: string; positive: boolean };
}

export function StatsCard({ label, value, icon, color, trend }: StatsCardProps) {
  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col justify-between h-[140px]">
      <div className="flex justify-between items-start">
        <p className="text-[var(--color-muted)] font-medium text-sm">{label}</p>
        {icon && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: color ? `${color}20` : "var(--color-mint-light)",
              color: color ?? "var(--color-mint)",
            }}
          >
            <span className="material-symbols-outlined text-lg">{icon}</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <h3 className="text-[32px] font-bold text-[var(--color-charcoal)] leading-none">
          {value}
        </h3>
        {trend && (
          <span
            className={`text-sm font-semibold flex items-center gap-0.5 ${
              trend.positive ? "text-[var(--color-mint)]" : "text-red-500"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {trend.positive ? "trending_up" : "trending_down"}
            </span>{" "}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
```

---

## Step 6: Rewrite ReviewCard

**File: `frontend/src/components/ReviewCard.tsx`**

Replace full file. Glass card with source icon, inline confidence badge, pill action buttons:

```tsx
import { useState } from "react";
import { Link } from "react-router";
import type { Review } from "../api/types";
import { Badge } from "./Badge";
import { decideReview } from "../api/reviews";
import { relativeTime, truncate } from "../utils/format";

interface ReviewCardProps {
  review: Review;
  onAction?: () => void;
}

const DOC_TYPE_ICONS: Record<string, string> = {
  api_reference: "code",
  how_to: "menu_book",
  troubleshooting: "troubleshoot",
  concept: "lightbulb",
  release_note: "new_releases",
};

export function ReviewCard({ review, onAction }: ReviewCardProps) {
  const [acting, setActing] = useState(false);

  const handleDecision = async (decision: "approve" | "reject") => {
    setActing(true);
    try {
      await decideReview(review.id, { decision, feedback: "" });
      onAction?.();
    } catch {
      setActing(false);
    }
  };

  const icon = DOC_TYPE_ICONS[review.doc_type] ?? "description";

  return (
    <div className="glass-card rounded-2xl p-5 flex items-center justify-between group">
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0 border border-gray-100">
          <span className="material-symbols-outlined text-lg text-[var(--color-muted)]">
            {icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge status={review.status} />
            <span className="text-xs text-[var(--color-muted)]">
              {relativeTime(review.created_at)}
            </span>
          </div>
          <h3 className="font-semibold text-[var(--color-charcoal)] group-hover:text-[var(--color-brand)] transition-colors">
            {review.title}
          </h3>
          <p className="text-sm text-[var(--color-muted)] line-clamp-1 mt-0.5">
            {truncate(review.content, 120)}
          </p>
          <div className="flex items-center gap-1 mt-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-white/60 px-2 py-0.5 rounded border border-white/80 text-[var(--color-charcoal)]">
              <span className="material-symbols-outlined text-[14px]">psychology</span>
              AI Confidence: {Math.round(review.confidence_score * 100)}%
            </span>
          </div>
        </div>
      </div>
      <div className="ml-4 shrink-0">
        {review.status === "pending" ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDecision("approve")}
              disabled={acting}
              className="bg-[var(--color-sage)] hover:opacity-90 text-white font-semibold text-xs px-5 h-10 rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              Approve
            </button>
            <Link
              to={`/review/${review.id}`}
              className="bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-semibold text-xs px-5 h-10 rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center"
            >
              Review
            </Link>
          </div>
        ) : (
          <Link
            to={`/review/${review.id}`}
            className="inline-flex items-center bg-white border border-gray-200 hover:border-gray-300 text-[var(--color-charcoal)] font-semibold text-xs px-5 h-10 rounded-full shadow-sm hover:shadow transition-all active:scale-95"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
}
```

---

## Step 7: Rewrite FilterTabs

**File: `frontend/src/components/FilterTabs.tsx`**

Replace full file. Glass pill tabs:

```tsx
interface Tab {
  key: string;
  label: string;
  count: number;
}

interface FilterTabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export function FilterTabs({ tabs, active, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-[var(--color-charcoal)] text-white shadow-sm"
                : "bg-white/40 text-[var(--color-muted)] hover:bg-white/60 hover:text-[var(--color-charcoal)] border border-white/60"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        );
      })}
    </div>
  );
}
```

---

## Step 8: Update EmptyState

**File: `frontend/src/components/EmptyState.tsx`**

Replace full file. Glass card wrapper, pill button:

```tsx
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = "📄", title, description, action }: EmptyStateProps) {
  return (
    <div className="glass-card rounded-2xl py-12 text-center text-[var(--color-muted)]">
      <div className="mb-2 text-4xl">{icon}</div>
      <div className="font-medium text-[var(--color-charcoal)]">{title}</div>
      {description && <div className="mt-1 text-sm">{description}</div>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-hover)] shadow-md transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

---

## Step 9: Update ConfidenceBar

**File: `frontend/src/components/ConfidenceBar.tsx`**

Replace raw Tailwind colors with theme-aware ones:

```tsx
export function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "bg-[var(--color-sage)]"
      : pct >= 50
        ? "bg-[var(--color-sand)]"
        : "bg-red-400";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-[var(--color-border)]">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-[var(--color-muted)]">{pct}%</span>
    </div>
  );
}
```

---

## Step 10: Rewrite Dashboard page

**File: `frontend/src/pages/Dashboard.tsx`**

This is the largest change. Add `useUser` from Clerk for personalized greeting. Replace the entire return block and add the `ActivityItem` helper.

New imports to add at top:

```tsx
import { useUser } from "@clerk/react";
```

New greeting logic inside the component (before the return):

```tsx
const { user } = useUser();
const firstName = user?.firstName ?? "there";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
```

Replace the full return block with the glassmorphism layout including personalized greeting, agent status pill, 3-col stats, 2-col main grid with activity panel. Replace the loading skeleton with shimmer. Add `ActivityItem` helper at bottom of file.

(See the full JSX in the code implementation — the structure matches the inspiration's greeting + metrics + action queue + activity timeline pattern.)

---

## Step 11: Verify build

```bash
cd frontend && npm run build
```

No TypeScript or build errors expected. All changes are in className strings and JSX structure, no new dependencies.

---

## Step 12: Verify typecheck

```bash
cd frontend && npx tsc --noEmit
```

---

## File Change Summary

| # | File | Change |
|---|------|--------|
| 1 | `frontend/index.html` | Add Material Symbols font link |
| 2 | `frontend/src/index.css` | Add CSS variables + glass/orb/shimmer utilities |
| 3 | `frontend/src/components/Layout.tsx` | Remove Header, add orbs, glass background |
| 4 | `frontend/src/components/Sidebar.tsx` | Full rewrite — glass panel, logo, nav icons, user profile |
| 5 | `frontend/src/components/StatsCard.tsx` | Full rewrite — glass card, icon, trend props |
| 6 | `frontend/src/components/ReviewCard.tsx` | Full rewrite — glass card, layout, pill buttons |
| 7 | `frontend/src/components/FilterTabs.tsx` | Full rewrite — glass pill tabs |
| 8 | `frontend/src/components/EmptyState.tsx` | Full rewrite — glass wrapper, pill button |
| 9 | `frontend/src/components/ConfidenceBar.tsx` | Theme colors |
| 10 | `frontend/src/pages/Dashboard.tsx` | Full restructure — greeting, stats, grid, activity panel |

**Total**: ~300 lines changed, 0 new files, 0 new dependencies. Header.tsx becomes unused (not deleted, just no longer imported).
