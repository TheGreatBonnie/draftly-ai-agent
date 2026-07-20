import { useEffect, useState } from "react";
import { getPendingReviews } from "../api/reviews";
import type { Review } from "../api/types";
import { ReviewCard } from "../components/ReviewCard";

export function Dashboard() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPendingReviews()
      .then(setReviews)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-gray-500">Loading reviews...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Pending Reviews ({reviews.length})</h1>
      {reviews.length === 0 ? (
        <p className="text-gray-500">No pending reviews.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
