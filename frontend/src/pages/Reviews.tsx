import { useEffect, useMemo, useState } from "react";
import { listDocs } from "../api/docs";
import type { Doc } from "../api/types";
import { ReviewDocCard } from "../components/ReviewDocCard";
import { EmptyState } from "../components/EmptyState";
import { FilterTabs } from "../components/FilterTabs";

type StatusFilter = "all" | "published" | "pending" | "draft" | "rejected";

export function Reviews() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const fetchDocs = () => {
    listDocs()
      .then(setDocs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: docs.length };
    for (const d of docs) c[d.status] = (c[d.status] ?? 0) + 1;
    return c;
  }, [docs]);

  const tabs = useMemo(
    () => [
      { key: "all" as const, label: "All", count: counts.all ?? 0 },
      { key: "published" as const, label: "Published", count: counts.published ?? 0 },
      { key: "pending" as const, label: "Pending", count: counts.pending ?? 0 },
      { key: "draft" as const, label: "Draft", count: counts.draft ?? 0 },
      { key: "rejected" as const, label: "Rejected", count: counts.rejected ?? 0 },
    ],
    [counts],
  );

  const filtered = useMemo(() => {
    let result = docs;

    if (activeTab !== "all") {
      result = result.filter((d) => d.status === activeTab);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q));
    }

    return result;
  }, [docs, activeTab, search]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-white/60 bg-white/40"
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
          className="mt-3 rounded-lg bg-[var(--color-charcoal)] px-4 py-2 text-sm font-medium text-[var(--color-surface)] hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[var(--text-heading)] font-bold text-[var(--color-charcoal)]">
          Reviews
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-muted)]">
          Browse and manage your AI-generated documentation.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <FilterTabs tabs={tabs} active={activeTab} onChange={(k) => setActiveTab(k as StatusFilter)} />
        <input
          type="text"
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-charcoal)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-charcoal)] focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={docs.length === 0 ? "📄" : "🔍"}
          title={
            docs.length === 0
              ? "No reviews yet"
              : "No documents match this filter"
          }
          description={
            docs.length === 0
              ? "Documentation is generated automatically from your support threads. Start a conversation on Slack or Discord to create your first doc."
              : "Try a different tab or adjust your search."
          }
          action={
            docs.length === 0
              ? { label: "Connect Slack", onClick: () => window.open("https://slack.com/apps", "_blank") }
              : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((doc) => (
            <ReviewDocCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
