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
    <div className="glass-card group flex items-center justify-between rounded-2xl p-5">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm">
          <span className="material-symbols-outlined text-lg text-[var(--color-muted)]">
            {icon}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Badge status={review.status} />
            <span className="text-xs text-[var(--color-muted)]">
              {relativeTime(review.created_at)}
            </span>
          </div>
          <h3 className="font-semibold text-[var(--color-charcoal)] transition-colors group-hover:text-[var(--color-brand)]">
            {review.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-sm text-[var(--color-muted)]">
            {truncate(review.content, 120)}
          </p>
          <div className="mt-2 flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded border border-white/80 bg-white/60 px-2 py-0.5 text-[11px] font-medium text-[var(--color-charcoal)]">
              <span className="material-symbols-outlined text-[14px]">
                psychology
              </span>
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
              className="h-10 rounded-full bg-[var(--color-sage)] px-5 text-xs font-semibold text-white shadow-md transition-all hover:shadow-lg hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              Approve
            </button>
            <Link
              to={`/review/${review.id}`}
              className="flex h-10 items-center rounded-full bg-[var(--color-brand)] px-5 text-xs font-semibold text-white shadow-md transition-all hover:shadow-lg hover:bg-[var(--color-brand-hover)] active:scale-95"
            >
              Review
            </Link>
          </div>
        ) : (
          <Link
            to={`/review/${review.id}`}
            className="inline-flex h-10 items-center rounded-full border border-gray-200 bg-white px-5 text-xs font-semibold text-[var(--color-charcoal)] shadow-sm transition-all hover:shadow hover:border-gray-300 active:scale-95"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
}
