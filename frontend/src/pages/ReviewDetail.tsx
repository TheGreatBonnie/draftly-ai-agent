import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { getReview, decideReview } from "../api/reviews";
import type { Review } from "../api/types";
import { Badge } from "../components/Badge";
import { ConfidenceBar } from "../components/ConfidenceBar";

export function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [review, setReview] = useState<Review | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getReview(id)
      .then(setReview)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDecision(decision: "approve" | "reject" | "revise") {
    if (!id) return;
    setSubmitting(true);
    try {
      await decideReview(id, { decision, feedback });
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading review...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  if (!review) {
    return <p className="text-gray-500">Review not found.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{review.title}</h1>
        <Badge status={review.status} />
      </div>
      <p className="mb-1 text-sm text-gray-500">
        {review.doc_type} · Confidence:{" "}
        <ConfidenceBar score={review.confidence_score} />
      </p>

      <div className="mt-4 rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">Generated Documentation</h2>
        <pre className="whitespace-pre-wrap text-sm text-gray-700">{review.content}</pre>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">Your Review</h2>
        <textarea
          className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          rows={4}
          placeholder="Add feedback (optional)..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handleDecision("approve")}
            disabled={submitting}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => handleDecision("revise")}
            disabled={submitting}
            className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            Request Changes
          </button>
          <button
            onClick={() => handleDecision("reject")}
            disabled={submitting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
