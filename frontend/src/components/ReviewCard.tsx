import { useState } from "react";
import { Link } from "react-router";
import type { Review } from "../api/types";
import { Badge } from "./Badge";
import { ConfidenceBar } from "./ConfidenceBar";
import { decideReview } from "../api/reviews";
import { relativeTime, truncate } from "../utils/format";

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

interface ReviewCardProps {
  review: Review;
  onAction?: () => void;
}

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

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow hover:shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
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
          <h3 className="font-semibold text-[var(--color-charcoal)]">
            {review.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
            {truncate(review.content, 120)}
          </p>
        </div>
        <div className="ml-4 flex flex-col items-end gap-2 shrink-0">
          <Badge status={review.status} />
          <div className="flex items-center gap-2">
            <ConfidenceBar score={review.confidence_score} />
            <span className="text-xs text-[var(--color-muted)]">
              {Math.round(review.confidence_score * 100)}%
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2 border-t border-[var(--color-border)] pt-3">
        {review.status === "pending" ? (
          <>
            <button
              onClick={() => handleDecision("approve")}
              disabled={acting}
              className="rounded-lg bg-[var(--color-sage)] px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              Approve
            </button>
            <Link
              to={`/review/${review.id}`}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-charcoal)] transition-colors hover:border-[var(--color-charcoal)]"
            >
              Review
            </Link>
            <button
              onClick={() => handleDecision("reject")}
              disabled={acting}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:border-[var(--color-charcoal)] hover:text-[var(--color-charcoal)] disabled:opacity-50"
            >
              Reject
            </button>
          </>
        ) : (
          <Link
            to={`/review/${review.id}`}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-charcoal)] transition-colors hover:border-[var(--color-charcoal)]"
          >
            View Document
          </Link>
        )}
      </div>
    </div>
  );
}
