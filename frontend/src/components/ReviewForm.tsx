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
        <p className="mb-3 text-sm text-[var(--color-muted)]">Ready to review?</p>
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-[var(--color-brand-hover)] hover:shadow-lg active:scale-95"
        >
          Open Review Panel
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <textarea
        className="mb-3 w-full rounded-xl border border-white/60 bg-white/40 p-3 text-sm text-[var(--color-charcoal)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-charcoal)] focus:outline-none"
        rows={4}
        placeholder="Add your review notes (optional)..."
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      {error && (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-sm text-red-600">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleSubmit("approve")}
          disabled={isSubmitting}
          className="rounded-full bg-[var(--color-sage)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("revise")}
          disabled={isSubmitting}
          className="rounded-full bg-[var(--color-sand)] px-5 py-2.5 text-sm font-medium text-[var(--color-charcoal)] hover:opacity-90 disabled:opacity-50"
        >
          Request Changes
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("reject")}
          disabled={isSubmitting}
          className="rounded-full bg-red-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
