import { useEffect, useMemo, useState } from "react";
import {
  listKnowledge,
  ingestKnowledge,
  deleteKnowledge,
} from "../api/knowledge";
import type { KnowledgeDoc, IngestKnowledgePayload } from "../api/types";
import { KnowledgeStats } from "../components/KnowledgeStats";
import { KnowledgeCard } from "../components/KnowledgeCard";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { URLImportForm } from "../components/URLImportForm";
import { FilterTabs } from "../components/FilterTabs";
import { EmptyState } from "../components/EmptyState";

const DOC_TYPES = ["howto", "faq", "tutorial", "troubleshooting", "reference"] as const;

type TabKey = "url" | "manual";

export function Knowledge() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("url");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDoc | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<string>("reference");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadDocs() {
    try {
      const data = await listKnowledge();
      setDocs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocs();
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
    ],
    [counts],
  );

  const filtered = useMemo(() => {
    let result = docs;

    if (filter !== "all") {
      result = result.filter((d) => d.status === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q));
    }

    return result;
  }, [docs, filter, search]);

  async function handleDelete(docId: string) {
    try {
      await deleteKnowledge(docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      setDeleteTarget(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
      setDeleteTarget(null);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: IngestKnowledgePayload = { title, content, doc_type: docType };
      await ingestKnowledge(payload);
      setTitle("");
      setContent("");
      setDocType("reference");
      await loadDocs();
      setActiveTab("url");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to add document");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="mb-5">
          <div className="h-7 w-48 animate-pulse rounded bg-[var(--color-border)]" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded bg-[var(--color-border)]" />
        </div>
        <div className="mb-5 grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
            />
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error && docs.length === 0) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-muted)]">Failed to load documents.</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            loadDocs();
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
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 font-medium text-red-700 hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-5">
        <h1 className="text-[var(--text-heading)] font-bold text-[var(--color-charcoal)]">
          Knowledge Base
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-muted)]">
          Add company documentation so the AI uses it as context when generating solutions.
        </p>
      </div>

      <KnowledgeStats docs={docs} />

      <div className="mb-6 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="mb-4 flex gap-0 border-b border-[var(--color-border)]">
          {(
            [
              { key: "url" as const, label: "Import from URL" },
              { key: "manual" as const, label: "Add Manually" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-[var(--color-brand)] text-[var(--color-charcoal)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-charcoal)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "url" && (
          <URLImportForm onIngested={loadDocs} active={activeTab === "url"} />
        )}

        {activeTab === "manual" && (
          <form onSubmit={handleManualSubmit}>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-[var(--color-charcoal)]">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Internal API Auth Guide"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm text-[var(--color-charcoal)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-charcoal)] focus:outline-none"
                required
              />
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-[var(--color-charcoal)]">
                Document Type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm text-[var(--color-charcoal)] focus:border-[var(--color-charcoal)] focus:outline-none"
              >
                {DOC_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-[var(--color-charcoal)]">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste or write your documentation here..."
                rows={6}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm text-[var(--color-charcoal)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-charcoal)] focus:outline-none"
                required
              />
            </div>
            {formError && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {formError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !title.trim() || !content.trim()}
                className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-hover)] disabled:opacity-50"
              >
                {submitting ? "Adding..." : "Add to Knowledge Base"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitle("");
                  setContent("");
                  setDocType("reference");
                  setFormError(null);
                  setActiveTab("url");
                }}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] transition-colors hover:border-[var(--color-charcoal)]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <FilterTabs tabs={tabs} active={filter} onChange={setFilter} />
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
          icon={docs.length === 0 ? "📚" : "🔍"}
          title={
            docs.length === 0
              ? "No documents yet"
              : "No documents match this filter"
          }
          description={
            docs.length === 0
              ? "Import documentation from a URL or add it manually to get started."
              : "Try a different tab or adjust your search."
          }
          action={
            docs.length === 0
              ? { label: "Import from URL", onClick: () => setActiveTab("url") }
              : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((doc) => (
            <KnowledgeCard
              key={doc.id}
              doc={doc}
              onDelete={(id) => {
                const doc = docs.find((d) => d.id === id);
                if (doc) setDeleteTarget(doc);
              }}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete document?"
        description={`This will permanently remove "${deleteTarget?.title ?? ""}" from your knowledge base. This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
