import { useEffect, useMemo, useState } from "react";
import { listDocs } from "../api/docs";
import type { Doc } from "../api/types";
import { DocCard } from "../components/DocCard";
import { EmptyState } from "../components/EmptyState";

type StatusFilter = "all" | "published" | "pending" | "draft" | "rejected";

export function Docs() {
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

  const tabs = useMemo(
    () => [
      { key: "all" as const, label: "All", count: docs.length },
      {
        key: "published" as const,
        label: "Published",
        count: docs.filter((d) => d.status === "published").length,
      },
      {
        key: "pending" as const,
        label: "Pending",
        count: docs.filter((d) => d.status === "pending").length,
      },
      {
        key: "draft" as const,
        label: "Draft",
        count: docs.filter((d) => d.status === "draft").length,
      },
      {
        key: "rejected" as const,
        label: "Rejected",
        count: docs.filter((d) => d.status === "rejected").length,
      },
    ],
    [docs],
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
            className="h-32 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-muted)]">Failed to load documentation.</p>
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
          Documentation
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-muted)]">
          Browse your AI-generated documentation library.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--color-charcoal)] text-[var(--color-surface)]"
                    : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-charcoal)] hover:text-[var(--color-charcoal)]"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>
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
              ? "No documentation yet"
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
            <DocCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
