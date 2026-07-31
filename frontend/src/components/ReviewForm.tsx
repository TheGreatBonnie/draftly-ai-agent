import { useState } from "react";

interface ReviewFormProps {
  onSubmit: (decision: "approve" | "reject" | "revise", feedback: string) => Promise<void>;
  isSubmitting: boolean;
  error?: string | null;
}

export function ReviewForm({ onSubmit, isSubmitting, error }: ReviewFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(decision: "approve" | "reject" | "revise") {
    await onSubmit(decision, feedback);
    setFeedback("");
    setIsExpanded(false);
  }

  if (!isExpanded) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center">
        <p className="mb-3 text-sm text-on-surface-variant">Ready to review?</p>
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary-container shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-95"
        >
          Open Review Panel
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <textarea
        className="mb-3 w-full rounded-xl border border-outline-variant bg-surface-container p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
        rows={4}
        placeholder="Add your review notes (optional)..."
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      {error && (
        <p className="mb-3 rounded-xl border border-error/30 bg-error-container/20 p-2.5 text-sm text-error">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleSubmit("approve")}
          disabled={isSubmitting}
          className="rounded-full bg-secondary px-5 py-2.5 text-sm font-medium text-on-secondary-container hover:opacity-90 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("revise")}
          disabled={isSubmitting}
          className="rounded-full bg-tertiary px-5 py-2.5 text-sm font-medium text-on-tertiary-container hover:opacity-90 disabled:opacity-50"
        >
          Request Changes
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("reject")}
          disabled={isSubmitting}
          className="rounded-full bg-error px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
