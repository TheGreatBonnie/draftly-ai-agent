# Knowledge Base Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Knowledge Base page to match the warm design system with tabbed forms, stats row, rich doc cards, filtering, search, and delete confirmation.

**Architecture:** Create 3 new components (KnowledgeStats, KnowledgeCard, ConfirmDialog), refactor URLImportForm to use warm tokens, and rewrite Knowledge.tsx with tabbed forms, filtering, search, and all UI states.

**Tech Stack:** React 19, TypeScript, TailwindCSS 4 with CSS custom properties, existing design system components (Badge, FilterTabs, EmptyState, StatsCard)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/KnowledgeStats.tsx` | Create | Stats row computing doc counts by status |
| `src/components/KnowledgeCard.tsx` | Create | Rich doc card with type badge, preview, status, confidence, delete |
| `src/components/ConfirmDialog.tsx` | Create | Reusable delete confirmation modal |
| `src/components/URLImportForm.tsx` | Modify | Accept `active` prop, replace raw colors with warm tokens |
| `src/pages/Knowledge.tsx` | Rewrite | Tabbed forms, stats, filtering, search, loading/error/empty states |

---

### Task 1: KnowledgeStats Component

**Files:**
- Create: `frontend/src/components/KnowledgeStats.tsx`

- [ ] **Step 1: Create KnowledgeStats component**

```tsx
import type { KnowledgeDoc } from "../api/types";
import { StatsCard } from "./StatsCard";

interface KnowledgeStatsProps {
  docs: KnowledgeDoc[];
}

export function KnowledgeStats({ docs }: KnowledgeStatsProps) {
  const counts = {
    total: docs.length,
    published: docs.filter((d) => d.status === "published").length,
    pending: docs.filter((d) => d.status === "pending").length,
    draft: docs.filter((d) => d.status === "draft").length,
  };

  return (
    <div className="mb-5 grid grid-cols-4 gap-3">
      <StatsCard label="Total Documents" value={counts.total} />
      <StatsCard
        label="Published"
        value={counts.published}
        color="var(--color-sage)"
      />
      <StatsCard
        label="Pending Review"
        value={counts.pending}
        color="var(--color-sand)"
      />
      <StatsCard label="Drafts" value={counts.draft} />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit` from `frontend/`
Expected: No output (clean)

- [ ] **Step 3: Commit**

```bash
git add src/components/KnowledgeStats.tsx
git commit -m "feat(knowledge): add KnowledgeStats component"
```

---

### Task 2: KnowledgeCard Component

**Files:**
- Create: `frontend/src/components/KnowledgeCard.tsx`

- [ ] **Step 1: Create KnowledgeCard component**

```tsx
import type { KnowledgeDoc } from "../api/types";
import { Badge } from "./Badge";
import { truncate, relativeTime } from "../utils/format";

const DOC_TYPE_STYLES: Record<string, string> = {
  howto: "bg-[var(--color-sage-light)] text-[var(--color-sage)]",
  faq: "bg-[var(--color-sand-light)] text-[var(--color-charcoal)]",
  tutorial: "bg-blue-50 text-blue-700",
  troubleshooting: "bg-[var(--color-terracotta-light)] text-[var(--color-terracotta)]",
  reference: "bg-gray-100 text-gray-600",
};

interface KnowledgeCardProps {
  doc: KnowledgeDoc;
  onDelete: (id: string) => void;
}

export function KnowledgeCard({ doc, onDelete }: KnowledgeCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[#d1cec9]">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[var(--color-charcoal)]">
            {doc.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${DOC_TYPE_STYLES[doc.doc_type] ?? "bg-gray-100 text-gray-600"}`}
            >
              {doc.doc_type}
            </span>
            <span>v{doc.version}</span>
            <span>·</span>
            <span>{relativeTime(doc.created_at)}</span>
          </div>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--color-muted)]">
        {truncate(doc.content, 150)}
      </p>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <div className="flex items-center gap-2.5">
          <Badge status={doc.status} />
          <span className="text-xs text-[var(--color-muted)]">
            <strong className="text-[var(--color-charcoal)]">
              {Math.round(doc.confidence_score * 100)}%
            </strong>{" "}
            confidence
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDelete(doc.id)}
          className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit` from `frontend/`
Expected: No output (clean)

- [ ] **Step 3: Commit**

```bash
git add src/components/KnowledgeCard.tsx
git commit -m "feat(knowledge): add KnowledgeCard component"
```

---

### Task 3: ConfirmDialog Component

**Files:**
- Create: `frontend/src/components/ConfirmDialog.tsx`

- [ ] **Step 1: Create ConfirmDialog component**

```tsx
import { useEffect, useCallback } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  danger = true,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="w-full max-w-sm rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold text-[var(--color-charcoal)]"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--color-border)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-charcoal)] transition-colors hover:border-[var(--color-charcoal)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium text-white transition-colors ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit` from `frontend/`
Expected: No output (clean)

- [ ] **Step 3: Commit**

```bash
git add src/components/ConfirmDialog.tsx
git commit -m "feat(knowledge): add ConfirmDialog component"
```

---

### Task 4: Refactor URLImportForm

**Files:**
- Modify: `frontend/src/components/URLImportForm.tsx`

- [ ] **Step 1: Read current URLImportForm**

Read: `frontend/src/components/URLImportForm.tsx` to understand current structure.

- [ ] **Step 2: Refactor URLImportForm with warm tokens and active prop**

Replace the entire file content:

```tsx
import { useState } from "react";
import { fetchUrlContent, ingestKnowledge } from "../api/knowledge";
import type { IngestKnowledgePayload } from "../api/types";

const DOC_TYPES = ["howto", "faq", "tutorial", "troubleshooting", "reference"] as const;

interface URLImportFormProps {
  onIngested: () => void;
  active: boolean;
}

type FormState = "idle" | "fetching" | "preview" | "submitting" | "error";

export function URLImportForm({ onIngested, active }: URLImportFormProps) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<string>("reference");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [error, setError] = useState("");

  if (!active) return null;

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setState("fetching");
    setError("");
    try {
      const result = await fetchUrlContent(url.trim());
      setTitle(result.title);
      setContent(result.content);
      setSourceUrl(result.url);
      setSourceType(result.source_type);
      setState("preview");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch URL";
      setError(message);
      setState("error");
    }
  }

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setState("submitting");
    setError("");
    try {
      const payload: IngestKnowledgePayload = {
        title,
        content,
        doc_type: docType,
        source_url: sourceUrl,
      };
      await ingestKnowledge(payload);
      resetForm();
      onIngested();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add document";
      setError(message);
      setState("preview");
    }
  }

  function resetForm() {
    setUrl("");
    setTitle("");
    setContent("");
    setDocType("reference");
    setSourceUrl("");
    setSourceType("");
    setError("");
    setState("idle");
  }

  function handleCancel() {
    resetForm();
  }

  return (
    <div>
      <form onSubmit={handleFetch}>
        <div className="mb-2.5 flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.example.com/api-guide"
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm text-[var(--color-charcoal)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-charcoal)] focus:outline-none"
            disabled={state === "fetching" || state === "submitting"}
            required
          />
          <button
            type="submit"
            disabled={state === "fetching" || state === "submitting" || !url.trim()}
            className="rounded-lg bg-[var(--color-charcoal)] px-4 py-2 text-sm font-medium text-[var(--color-surface)] hover:opacity-90 disabled:opacity-50"
          >
            {state === "fetching" ? "Fetching..." : "Fetch"}
          </button>
        </div>
      </form>

      <p className="mb-3 text-xs text-[var(--color-muted)]">
        Paste a URL and we'll extract the content automatically.
      </p>

      {state === "error" && error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {state === "preview" && (
        <form onSubmit={handleIngest}>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--color-sage-light)] px-2.5 py-1 text-xs font-medium text-[var(--color-sage)]">
            Source: {sourceUrl} ({sourceType})
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-[var(--color-charcoal)]">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
              rows={10}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm text-[var(--color-charcoal)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-charcoal)] focus:outline-none"
              required
            />
          </div>
          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={state === "submitting" || !title.trim() || !content.trim()}
              className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-hover)] disabled:opacity-50"
            >
              {state === "submitting" ? "Adding..." : "Add to Knowledge Base"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={state === "submitting"}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] transition-colors hover:border-[var(--color-charcoal)] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npx tsc --noEmit` from `frontend/`
Expected: No output (clean)

- [ ] **Step 4: Commit**

```bash
git add src/components/URLImportForm.tsx
git commit -m "refactor(knowledge): update URLImportForm with warm tokens and active prop"
```

---

### Task 5: Rewrite Knowledge.tsx

**Files:**
- Rewrite: `frontend/src/pages/Knowledge.tsx`

- [ ] **Step 1: Read current Knowledge.tsx**

Read: `frontend/src/pages/Knowledge.tsx` to understand current structure.

- [ ] **Step 2: Rewrite Knowledge.tsx**

Replace the entire file content:

```tsx
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
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npx tsc --noEmit` from `frontend/`
Expected: No output (clean)

- [ ] **Step 4: Verify production build passes**

Run: `npx vite build` from `frontend/`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/pages/Knowledge.tsx
git commit -m "feat(knowledge): redesign Knowledge page with tabs, stats, cards, filtering"
```

---

### Task 6: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit` from `frontend/`
Expected: No output (clean)

- [ ] **Step 2: Run full build**

Run: `npx vite build` from `frontend/`
Expected: Build succeeds

- [ ] **Step 3: Lint new/modified files**

Run: `npx eslint src/components/KnowledgeStats.tsx src/components/KnowledgeCard.tsx src/components/ConfirmDialog.tsx src/components/URLImportForm.tsx src/pages/Knowledge.tsx --max-warnings=0` from `frontend/`
Expected: No output (clean)

- [ ] **Step 4: Visual verification**

Start dev server (`npm run dev`) and verify:
- Stats row shows correct counts
- Tab switching works between URL import and manual form
- URL import flow works end-to-end
- Manual form submits and reloads list
- Filter tabs filter correctly
- Search filters by title
- Delete confirmation modal appears and works
- Loading skeletons display on initial load
- Empty states display correctly
- No raw Tailwind color classes (gray-*, blue-*, red-*) in new/modified files
