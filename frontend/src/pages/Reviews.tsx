import { useEffect, useState } from "react";
import { listDocs } from "../api/docs";
import type { Doc } from "../api/types";
import { ReviewDocCard } from "../components/ReviewDocCard";
import { EmptyState } from "../components/EmptyState";

export function Reviews() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocs = () => {
    listDocs()
      .then(setDocs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="glass-card h-32 animate-pulse rounded-2xl"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-muted)]">Failed to load reviews.</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchDocs();
          }}
          className="mt-3 rounded-full bg-[var(--color-charcoal)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  const drafts = docs.filter((d) => d.status === "draft").length;

  return (
    <div>
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-charcoal)] tracking-tight mb-1">
            Reviews
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            Browse and manage your AI-generated documentation.
          </p>
        </div>
        <div className="glass-card flex items-center gap-2 rounded-full px-4 py-2">
          <span className="text-sm font-medium text-[var(--color-charcoal)]">
            {drafts} drafts
          </span>
        </div>
      </header>

      {docs.length === 0 ? (
        <EmptyState
          icon="menu_book"
          title="No reviews yet"
          description="Documentation is generated automatically from your support threads. Start a conversation on Slack or Discord to create your first doc."
          action={{
            label: "Connect Slack",
            onClick: () => window.open("https://slack.com/apps", "_blank"),
          }}
        />
      ) : (
        <div className="flex max-w-4xl flex-col gap-4">
          {docs.map((doc) => (
            <ReviewDocCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
