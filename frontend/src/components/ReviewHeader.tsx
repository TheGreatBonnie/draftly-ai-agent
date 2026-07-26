import { useNavigate } from "react-router";
import { Badge } from "./Badge";
import { relativeTime } from "../utils/format";
import type { Review } from "../api/types";

interface ReviewHeaderProps {
  review: Review;
}

export function ReviewHeader({ review }: ReviewHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="mb-6">
      <button
        onClick={() => navigate("/reviews")}
        className="mb-4 text-sm font-medium text-terracotta hover:text-terracotta/80"
      >
        ← Back to Reviews
      </button>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-warm-900">{review.title}</h1>
        <Badge status={review.status} />
      </div>

      <p className="mt-2 text-sm text-warm-500">
        {review.doc_type} · Requested {relativeTime(review.created_at)}
      </p>
    </div>
  );
}
