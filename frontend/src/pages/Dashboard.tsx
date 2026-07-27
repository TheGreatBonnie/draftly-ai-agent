import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { getAllReviews } from "../api/reviews";
import type { Review } from "../api/types";
import { StatsCard } from "../components/StatsCard";
import { FilterTabs } from "../components/FilterTabs";
import { ReviewCard } from "../components/ReviewCard";
import { EmptyState } from "../components/EmptyState";

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

function ActivityItem({
  icon,
  iconBg,
  iconColor,
  title,
  meta,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: React.ReactNode;
  meta: string;
}) {
  return (
    <div className="relative pl-10">
      <div
        className={`absolute left-0 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white ${iconBg}`}
      >
        <span className={`material-symbols-outlined text-[16px] ${iconColor}`}>
          {icon}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug text-[var(--color-charcoal)]">
        {title}
      </p>
      <p className="mt-0.5 text-xs text-[var(--color-muted)]">{meta}</p>
    </div>
  );
}

export function Dashboard() {
  const { user } = useUser();
  const firstName = user?.firstName ?? "there";

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
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card shimmer h-32 rounded-2xl" />
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
          className="mt-3 rounded-full bg-[var(--color-charcoal)] px-4 py-2 text-sm font-medium text-[var(--color-surface)] hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Greeting ── */}
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="mb-1 text-[var(--text-heading)] font-bold tracking-tight text-[var(--color-charcoal)]">
            {getGreeting()}, {firstName}.
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            Your AI agent has been busy. Here's what's happening.
          </p>
        </div>
        <div className="glass-card flex items-center gap-2 rounded-full px-4 py-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-mint)] opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-mint)]" />
          </span>
          <span className="text-sm font-medium text-[var(--color-charcoal)]">
            Agent Active
          </span>
        </div>
      </header>

      {/* ── Stats ── */}
      <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        <StatsCard
          label="Pending Reviews"
          value={stats.pending}
          icon="pending_actions"
          color="#e07a5f"
        />
        <StatsCard
          label="Approved"
          value={stats.approved}
          icon="check_circle"
          color="#81b29a"
          trend={{ value: "this week", positive: true }}
        />
        <StatsCard
          label="Avg Confidence"
          value={`${Math.round(stats.avgConfidence * 100)}%`}
          icon="psychology"
          color="#4ECDC4"
        />
      </section>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Reviews */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-[var(--color-charcoal)]">
                Action Required
              </h2>
              {stats.pending > 0 && (
                <span className="rounded-full bg-[var(--color-sand-light)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-800">
                  {stats.pending} Pending
                </span>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No reviews match this filter"
              description="Try a different tab or adjust your search."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {filtered.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onAction={fetchReviews}
                />
              ))}
            </div>
          )}
        </section>

        {/* Right: Activity Panel */}
        <section className="lg:col-span-1">
          <div className="glass-panel rounded-3xl p-6">
            <h3 className="mb-5 text-lg font-bold text-[var(--color-charcoal)]">
              Recent Activity
            </h3>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute bottom-0 left-[15px] top-2 w-px bg-gradient-to-b from-gray-300 to-transparent" />

              <div className="flex flex-col gap-5">
                <ActivityItem
                  icon="check"
                  iconBg="bg-[var(--color-mint-light)]"
                  iconColor="text-[var(--color-mint)]"
                  title={
                    <>
                      Agent auto-published{" "}
                      <strong>"Webhooks V2 Overview"</strong>
                    </>
                  }
                  meta="10 mins ago • Confidence threshold met (96%)"
                />
                <ActivityItem
                  icon="edit"
                  iconBg="bg-blue-100"
                  iconColor="text-blue-500"
                  title={
                    <>
                      Agent drafted{" "}
                      <strong>"Updating billing address"</strong>
                    </>
                  }
                  meta="45 mins ago • From Zendesk"
                />
                <ActivityItem
                  icon="search"
                  iconBg="bg-gray-100"
                  iconColor="text-gray-500"
                  title={
                    <>
                      Detected cluster:{" "}
                      <em>"EU Checkout errors"</em>
                    </>
                  }
                  meta="1 hour ago • 4 similar tickets found"
                />
                <ActivityItem
                  icon="check"
                  iconBg="bg-[var(--color-mint-light)]"
                  iconColor="text-[var(--color-mint)]"
                  title={
                    <>
                      Sarah W. approved <strong>"OAuth Scopes"</strong>
                    </>
                  }
                  meta="3 hours ago"
                />
              </div>
            </div>

            <button className="mt-5 w-full rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-charcoal)] transition-colors hover:bg-white/50">
              View All History
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
