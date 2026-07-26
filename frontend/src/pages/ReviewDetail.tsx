import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { getReview, decideReview } from "../api/reviews";
import type { Review } from "../api/types";
import { ReviewHeader } from "../components/ReviewHeader";
import { ConfidenceComparison } from "../components/ConfidenceComparison";
import { ReviewContent } from "../components/ReviewContent";
import { ReviewForm } from "../components/ReviewForm";

export function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getReview(id)
      .then(setReview)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function handleRetry() {
    if (!id) return;
    setLoading(true);
    setError(null);
    getReview(id)
      .then(setReview)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleDecision(decision: "approve" | "reject" | "revise", feedback: string) {
    if (!id) return;
    setSubmitting(true);
    try {
      await decideReview(id, { decision, feedback });
      navigate("/reviews");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl animate-pulse">
        <div className="mb-4 h-4 w-32 rounded bg-warm-200" />
        <div className="mb-2 h-7 w-2/3 rounded bg-warm-200" />
        <div className="mb-6 h-4 w-48 rounded bg-warm-200" />
        <div className="mb-6 h-32 rounded-lg bg-warm-200" />
        <div className="h-64 rounded-lg bg-warm-200" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-2 text-sm font-medium text-red-600">Failed to load review</p>
        <p className="mb-4 text-sm text-warm-500">
          Please check your connection and try again.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={handleRetry}
            className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta/90"
          >
            Retry
          </button>
          <button
            onClick={() => navigate("/reviews")}
            className="rounded-lg bg-warm-100 px-4 py-2 text-sm font-medium text-warm-900 hover:bg-warm-200"
          >
            ← Back to Reviews
          </button>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-warm-200 bg-white p-6 text-center">
        <p className="text-sm text-warm-500">Review not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ReviewHeader review={review} />
      <ConfidenceComparison
        before={review.confidence_before}
        after={review.confidence_after}
      />
      <ReviewContent content={review.content} />
      <ReviewForm onSubmit={handleDecision} isSubmitting={submitting} />
    </div>
  );
}
