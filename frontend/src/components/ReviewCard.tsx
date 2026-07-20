import { Link } from "react-router";
import type { Review } from "../api/types";
import { Badge } from "./Badge";
import { ConfidenceBar } from "./ConfidenceBar";

export function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{review.title}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {review.doc_type} · {new Date(review.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge status={review.status} />
      </div>
      <div className="mt-3">
        <ConfidenceBar score={review.confidence_score} />
      </div>
      <Link
        to={`/review/${review.id}`}
        className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        Review →
      </Link>
    </div>
  );
}
