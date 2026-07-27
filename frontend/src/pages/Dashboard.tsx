import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { getAllReviews } from "../api/reviews";
import type { Review } from "../api/types";
import { StatsCard } from "../components/StatsCard";
import { FilterTabs } from "../components/FilterTabs";
import { ReviewCard } from "../components/ReviewCard";
import { EmptyState } from "../components/EmptyState";
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
  const { user } = useUser();
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
            {getGreeting()}, {user?.firstName || "there"}.
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

      {/* Main Grid: Reviews + Activity Feed */}
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
