import { Link } from "react-router";
import { Badge } from "./Badge";
import { relativeTime } from "../utils/format";
import type { Review } from "../api/types";

interface ReviewHeaderProps {
  review: Review;
}

export function ReviewHeader({ review }: ReviewHeaderProps) {
  return (
    <div className="mb-6">
      <Link
        to="/reviews"
        className="mb-4 text-sm font-medium text-[var(--color-brand)] hover:text-[var(--color-brand-hover)]"
      >
        ← Back to Reviews
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--color-charcoal)]">{review.title}</h1>
        <Badge status={review.status} />
      </div>

      <p className="mt-2 text-sm text-[var(--color-muted)]">
        {review.doc_type} · Requested {relativeTime(review.created_at)}
      </p>
    </div>
  );
}
