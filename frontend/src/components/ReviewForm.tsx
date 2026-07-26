import { useState } from "react";

interface ReviewFormProps {
  onSubmit: (decision: "approve" | "reject" | "revise", feedback: string) => Promise<void>;
  isSubmitting: boolean;
}

export function ReviewForm({ onSubmit, isSubmitting }: ReviewFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(decision: "approve" | "reject" | "revise") {
    await onSubmit(decision, feedback);
    setFeedback("");
    setIsExpanded(false);
  }

  if (!isExpanded) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border-light)] p-6 text-center">
        <p className="mb-3 text-sm text-[var(--color-muted)]">Ready to review?</p>
        <button
          onClick={() => setIsExpanded(true)}
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-hover)]"
        >
          Open Review Panel
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <textarea
        className="mb-3 w-full rounded-lg border border-[var(--color-border)] p-3 text-sm focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]"
        rows={4}
        placeholder="Add your review notes (optional)..."
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={() => handleSubmit("approve")}
          disabled={isSubmitting}
          className="rounded-lg bg-[var(--color-sage)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-sage)]/80 disabled:opacity-50"
        >
          ✓ Approve
        </button>
        <button
          onClick={() => handleSubmit("revise")}
          disabled={isSubmitting}
          className="rounded-lg bg-[var(--color-sand)] px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] hover:bg-[var(--color-sand)]/80 disabled:opacity-50"
        >
          ✎ Request Changes
        </button>
        <button
          onClick={() => handleSubmit("reject")}
          disabled={isSubmitting}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          ✗ Reject
        </button>
      </div>
    </div>
  );
}
