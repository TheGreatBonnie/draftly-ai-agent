# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Dashboard with a two-column layout, enhanced stats cards, action queue, activity timeline, and subtle visual effects.

**Architecture:** Keep existing components (StatsCard, ReviewCard, FilterTabs) and enhance them. Add new components (ActivityFeed, ActionQueue, BackgroundOrbs). Restructure Dashboard.tsx to use a 2/3 + 1/3 grid layout.

**Tech Stack:** React 19, TypeScript, TailwindCSS 4, Space Grotesk font

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/index.css` | Modify | Add Space Grotesk font, orb animations, glass utilities |
| `frontend/src/components/BackgroundOrbs.tsx` | Create | Animated background gradient orbs |
| `frontend/src/components/StatsCard.tsx` | Modify | Add icon, trend indicator, hover effect |
| `frontend/src/components/ActivityFeed.tsx` | Create | Timeline component for recent actions |
| `frontend/src/components/ActionQueue.tsx` | Create | Pending reviews queue with source icons |
| `frontend/src/components/ReviewCard.tsx` | Modify | Add source icon, confidence badge, error state |
| `frontend/src/pages/Dashboard.tsx` | Modify | Restructure layout, add greeting, integrate new components |

---

### Task 1: Add Space Grotesk Font and CSS Utilities

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add Space Grotesk font import and CSS utilities**

Add to the top of `index.css` (after the `@import "tailwindcss"` line):

```css
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap");
```

Add to the `@theme` block:

```css
--font-heading: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
```

Add at the end of the file (after `.prose hr`):

```css
/* Glass panel utility */
.glass-panel {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.8);
}

/* Card hover lift */
.card-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

/* Background orb animation */
@keyframes float {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(40px, -40px) scale(1.05); }
  100% { transform: translate(-20px, 20px) scale(0.95); }
}

/* Ping animation for status indicator */
@keyframes ping-slow {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add Space Grotesk font and CSS utilities for dashboard"
```

---

### Task 2: Create BackgroundOrbs Component

**Files:**
- Create: `frontend/src/components/BackgroundOrbs.tsx`

- [ ] **Step 1: Create the component file**

```tsx
export function BackgroundOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Sage orb - top left */}
      <div
        className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full opacity-[0.08]"
        style={{
          background: "var(--color-sage)",
          filter: "blur(100px)",
          animation: "float 20s infinite alternate ease-in-out",
        }}
      />
      {/* Brand orb - bottom right */}
      <div
        className="absolute -bottom-40 -right-32 h-[600px] w-[600px] rounded-full opacity-[0.06]"
        style={{
          background: "var(--color-brand)",
          filter: "blur(100px)",
          animation: "float 20s infinite alternate ease-in-out",
          animationDelay: "-10s",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BackgroundOrbs.tsx
git commit -m "feat: add BackgroundOrbs component"
```

---

### Task 3: Enhance StatsCard Component

**Files:**
- Modify: `frontend/src/components/StatsCard.tsx`

- [ ] **Step 1: Replace entire file content**

```tsx
interface StatsCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: string;
}

export function StatsCard({ label, value, icon, color, trend }: StatsCardProps) {
  return (
    <div className="card-hover rounded-2xl border border-[var(--color-border)] bg-white/70 p-5">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-[var(--color-muted)]">
          {label}
        </span>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}20` }}
        >
          <span className="material-symbols-outlined text-lg" style={{ color }}>
            {icon}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className="text-[32px] font-bold leading-none"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-charcoal)" }}
        >
          {value}
        </span>
        {trend && (
          <span className="flex items-center text-sm font-medium text-[var(--color-sage)]">
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            {trend}
          </span>
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
git add frontend/src/components/StatsCard.tsx
git commit -m "feat: enhance StatsCard with icon, trend, and hover effect"
```

---

### Task 4: Create ActionQueue Component

**Files:**
- Create: `frontend/src/components/ActionQueue.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import { Link } from "react-router";
import type { Review } from "../api/types";
import { relativeTime } from "../utils/format";

interface ActionQueueProps {
  reviews: Review[];
}

const DOC_TYPE_ICONS: Record<string, string> = {
  slack: "https://cdn.simpleicons.org/slack/4A154B",
  github: "https://cdn.simpleicons.org/github/24292e",
  discord: "https://cdn.simpleicons.org/discord/5865F2",
};

function getSourceIcon(docType: string): string {
  const lower = docType.toLowerCase();
  for (const [key, url] of Object.entries(DOC_TYPE_ICONS)) {
    if (lower.includes(key)) return url;
  }
  return "https://cdn.simpleicons.org/article/6b7280";
}

export function ActionQueue({ reviews }: ActionQueueProps) {
  const pending = reviews.filter((r) => r.status === "pending");
  const hasError = (r: Review) => r.content.includes("error") || r.content.includes("failed");

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2
          className="text-xl font-bold text-[var(--color-charcoal)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Action Required
        </h2>
        <span className="rounded-full bg-[var(--color-sand-light)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--color-charcoal)]">
          {pending.length} Pending
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-white/50 p-8 text-center">
            <p className="text-sm text-[var(--color-muted)]">No pending reviews</p>
          </div>
        ) : (
          pending.map((review) => {
            const isError = hasError(review);
            return (
              <div
                key={review.id}
                className={`card-hover group flex items-center justify-between rounded-2xl border bg-white/60 p-5 ${
                  isError
                    ? "border-red-200/50 hover:border-red-300"
                    : "border-[var(--color-border)]"
                }`}
              >
                {isError && (
                  <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-red-400" />
                )}
                <div className={`flex items-start gap-4 ${isError ? "pl-2" : ""}`}>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm">
                    <img
                      alt={review.doc_type}
                      className={`h-6 w-6 ${isError ? "grayscale opacity-50" : ""}`}
                      src={getSourceIcon(review.doc_type)}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-1 text-base font-semibold text-[var(--color-charcoal)] group-hover:text-[var(--color-brand)] transition-colors">
                      {review.title}
                    </h3>
                    {isError ? (
                      <>
                        <p className="mb-1 flex items-center gap-1 text-sm font-medium text-red-500/80">
                          <span className="material-symbols-outlined text-[16px]">error</span>
                          Connection lost during drafting
                        </p>
                        <p className="text-xs text-[var(--color-muted)]">
                          Partial draft saved. Please review manually.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mb-2 line-clamp-1 text-sm text-[var(--color-muted)]">
                          {review.content.slice(0, 100)}...
                        </p>
                        <span className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-white/60 px-2 py-0.5 text-[11px] font-medium text-[var(--color-charcoal)]">
                          <span className="material-symbols-outlined text-[14px]">psychology</span>
                          AI Confidence: {Math.round(review.confidence_score * 100)}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Link
                  to={`/review/${review.id}`}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-md transition-all active:scale-95 ${
                    isError
                      ? "border border-gray-200 bg-white text-[var(--color-charcoal)] hover:border-gray-300 hover:shadow"
                      : "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] hover:shadow-lg"
                  }`}
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {isError ? "Fix Issue" : "Review"}
                  {!isError && (
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  )}
                </Link>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ActionQueue.tsx
git commit -m "feat: add ActionQueue component"
```

---

### Task 5: Create ActivityFeed Component

**Files:**
- Create: `frontend/src/components/ActivityFeed.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import type { Review } from "../api/types";
import { relativeTime } from "../utils/format";

interface ActivityFeedProps {
  reviews: Review[];
}

interface ActivityItem {
  id: string;
  type: "approved" | "drafted" | "needs_changes" | "rejected";
  title: string;
  timestamp: string;
  context?: string;
}

function deriveActivity(reviews: Review[]): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const review of reviews.slice(0, 20)) {
    if (review.status === "approved" && review.completed_at) {
      items.push({
        id: review.id,
        type: "approved",
        title: review.title,
        timestamp: review.completed_at,
        context: `Confidence: ${Math.round(review.confidence_score * 100)}%`,
      });
    } else if (review.status === "needs_changes") {
      items.push({
        id: review.id,
        type: "needs_changes",
        title: review.title,
        timestamp: review.created_at,
        context: "Changes requested",
      });
    } else if (review.status === "rejected") {
      items.push({
        id: review.id,
        type: "rejected",
        title: review.title,
        timestamp: review.completed_at ?? review.created_at,
      });
    } else if (review.status === "pending") {
      items.push({
        id: review.id,
        type: "drafted",
        title: review.title,
        timestamp: review.created_at,
        context: review.doc_type,
      });
    }
  }

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  approved: { icon: "check", color: "var(--color-sage)", bg: "var(--color-sage-light)" },
  drafted: { icon: "edit", color: "#3b82f6", bg: "#dbeafe" },
  needs_changes: { icon: "pending", color: "var(--color-sand)", bg: "var(--color-sand-light)" },
  rejected: { icon: "close", color: "#ef4444", bg: "#fee2e2" },
};

export function ActivityFeed({ reviews }: ActivityFeedProps) {
  const items = deriveActivity(reviews);

  return (
    <section className="glass-panel rounded-3xl p-6">
      <h2
        className="mb-5 text-xl font-bold text-[var(--color-charcoal)]"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Recent Activity
      </h2>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-2 bottom-0 w-px bg-gradient-to-b from-[var(--color-border)] to-transparent" />

        <div className="flex flex-col gap-5">
          {items.map((item) => {
            const config = TYPE_CONFIG[item.type];
            return (
              <div key={item.id} className="relative pl-10">
                <div
                  className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white z-10"
                  style={{ backgroundColor: config.bg }}
                >
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={{ color: config.color }}
                  >
                    {config.icon}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug text-[var(--color-charcoal)]">
                  Agent {item.type === "approved" ? "auto-published" : item.type === "drafted" ? "drafted" : item.type}{" "}
                  <span className="font-bold">"{item.title}"</span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {relativeTime(item.timestamp)}
                  {item.context && ` • ${item.context}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <button className="mt-5 w-full rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-charcoal)] transition-colors hover:bg-white/50">
        View All History
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ActivityFeed.tsx
git commit -m "feat: add ActivityFeed component"
```

---

### Task 6: Enhance ReviewCard with Source Icons and Error State

**Files:**
- Modify: `frontend/src/components/ReviewCard.tsx`

- [ ] **Step 1: Add source icon helper and update component**

Add this helper function near the top of the file (after imports):

```tsx
const DOC_TYPE_ICONS: Record<string, string> = {
  slack: "https://cdn.simpleicons.org/slack/4A154B",
  github: "https://cdn.simpleicons.org/github/24292e",
  discord: "https://cdn.simpleicons.org/discord/5865F2",
};

function getSourceIcon(docType: string): string {
  const lower = docType.toLowerCase();
  for (const [key, url] of Object.entries(DOC_TYPE_ICONS)) {
    if (lower.includes(key)) return url;
  }
  return "https://cdn.simpleicons.org/article/6b7280";
}
```

Update the ReviewCard component to include the source icon in the header area. Find the existing `<span>` with `bg-[var(--color-sage-light)]` and add an icon before it:

```tsx
<div className="mb-1.5 flex items-center gap-2">
  <img
    alt={review.doc_type}
    className="h-4 w-4"
    src={getSourceIcon(review.doc_type)}
  />
  <span className="rounded-full bg-[var(--color-sage-light)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--color-sage)]">
    {review.doc_type}
  </span>
  <span className="text-xs text-[var(--color-muted)]">
    {relativeTime(review.created_at)}
  </span>
</div>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ReviewCard.tsx
git commit -m "feat: add source icons to ReviewCard"
```

---

### Task 7: Rewrite Dashboard Page

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace entire file content**

```tsx
import { useEffect, useMemo, useState } from "react";
import { getAllReviews } from "../api/reviews";
import type { Review } from "../api/types";
import { StatsCard } from "../components/StatsCard";
import { FilterTabs } from "../components/FilterTabs";
import { EmptyState } from "../components/EmptyState";
import { ActionQueue } from "../components/ActionQueue";
import { ActivityFeed } from "../components/ActivityFeed";
import { BackgroundOrbs } from "../components/BackgroundOrbs";

type SortKey = "newest" | "oldest" | "confidence_desc" | "confidence_asc";

function computeStats(reviews: Review[]) {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const pending = reviews.filter((r) => r.status === "pending").length;
  const approved = reviews.filter((r) => r.status === "approved").length;
  const thisWeek = reviews.filter(
    (r) => new Date(r.created_at).getTime() > sevenDaysAgo,
  ).length;
  const avgConfidence =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.confidence_score ?? 0), 0) /
        reviews.length
      : 0;

  return { pending, approved, thisWeek, avgConfidence };
}

function sortReviews(reviews: Review[], sort: SortKey): Review[] {
  const sorted = [...reviews];
  switch (sort) {
    case "newest":
      return sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case "oldest":
      return sorted.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    case "confidence_desc":
      return sorted.sort(
        (a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0),
      );
    case "confidence_asc":
      return sorted.sort(
        (a, b) => (a.confidence_score ?? 0) - (b.confidence_score ?? 0),
      );
  }
}

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest ↓",
  oldest: "Oldest ↑",
  confidence_desc: "Confidence ↓",
  confidence_asc: "Confidence ↑",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Dashboard() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  const fetchReviews = () => {
    getAllReviews()
      .then(setReviews)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const stats = useMemo(() => computeStats(reviews), [reviews]);

  const tabs = useMemo(
    () => [
      { key: "all", label: "All", count: reviews.length },
      {
        key: "pending",
        label: "Pending",
        count: reviews.filter((r) => r.status === "pending").length,
      },
      {
        key: "approved",
        label: "Approved",
        count: reviews.filter((r) => r.status === "approved").length,
      },
      {
        key: "rejected",
        label: "Rejected",
        count: reviews.filter((r) => r.status === "rejected").length,
      },
      {
        key: "needs_changes",
        label: "Needs Changes",
        count: reviews.filter((r) => r.status === "needs_changes").length,
      },
    ],
    [reviews],
  );

  const filtered = useMemo(() => {
    let result = reviews;

    if (activeTab !== "all") {
      result = result.filter((r) => r.status === activeTab);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.title.toLowerCase().includes(q));
    }

    return sortReviews(result, sort);
  }, [reviews, activeTab, search, sort]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-[var(--color-border)] bg-white/50"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-muted)]">Failed to load reviews.</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchReviews();
          }}
          className="mt-3 rounded-lg bg-[var(--color-charcoal)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />

      {/* Header */}
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1
            className="mb-1 text-4xl font-bold tracking-tight text-[var(--color-charcoal)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {getGreeting()}, Sarah.
          </h1>
          <p className="text-[var(--color-muted)]">
            Your AI agent has been busy. Here's what's happening.
          </p>
        </div>
        <div className="glass-panel flex items-center gap-2.5 rounded-full px-4 py-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-sage)] opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--color-sage)]" />
          </span>
          <span className="text-sm font-medium text-[var(--color-charcoal)]">
            Agent Listening
          </span>
        </div>
      </header>

      {/* Stats Row */}
      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Pending Reviews"
          value={stats.pending}
          icon="pending"
          color="var(--color-sand)"
        />
        <StatsCard
          label="Approved"
          value={stats.approved}
          icon="check_circle"
          color="var(--color-sage)"
          trend="+12%"
        />
        <StatsCard
          label="This Week"
          value={stats.thisWeek}
          icon="date_range"
          color="var(--color-muted)"
        />
        <StatsCard
          label="Avg Confidence"
          value={`${Math.round(stats.avgConfidence * 100)}%`}
          icon="psychology"
          color="var(--color-brand)"
        />
      </section>

      {/* Main Grid: Action Queue + Activity Feed */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: All Reviews with Filters */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <FilterTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 rounded-lg border border-[var(--color-border)] bg-white/60 px-3 py-1.5 text-sm text-[var(--color-charcoal)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-charcoal)] focus:outline-none"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-lg border border-[var(--color-border)] bg-white/60 px-3 py-1.5 text-sm text-[var(--color-charcoal)] focus:border-[var(--color-charcoal)] focus:outline-none"
              >
                {Object.entries(SORT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No reviews match this filter"
              description="Try a different tab or adjust your search."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((review) => (
                <ReviewCard key={review.id} review={review} onAction={fetchReviews} />
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Activity Feed */}
        <section className="lg:col-span-1">
          <ActivityFeed reviews={reviews} />
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: redesign Dashboard with two-column layout and activity feed"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `cd frontend && npm run lint`
Expected: No new errors

- [ ] **Step 4: Visual verification**

1. Start dev server: `cd frontend && npm run dev`
2. Verify background orbs render at low opacity
3. Verify Space Grotesk font loads for headings
4. Verify stats cards show icons and trend indicators
5. Verify stats cards have hover lift effect
6. Verify activity feed shows in right column
7. Verify all existing functionality works (filter, search, sort)

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address review feedback"
```

---

## Self-Review Checklist

- [ ] All spec acceptance criteria covered
- [ ] No placeholders or TODOs in plan
- [ ] All types consistent across tasks
- [ ] All file paths correct
- [ ] All code blocks complete and correct
