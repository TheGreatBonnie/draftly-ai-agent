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
