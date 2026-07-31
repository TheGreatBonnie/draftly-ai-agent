import { useState } from "react";
import { fetchUrlContent, ingestKnowledge } from "../api/knowledge";
import type { IngestKnowledgePayload } from "../api/types";

const DOC_TYPES = ["howto", "faq", "tutorial", "troubleshooting", "reference"] as const;

const inputClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none";

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
            className={`${inputClass} flex-1`}
            disabled={state === "fetching" || state === "submitting"}
            required
          />
          <button
            type="submit"
            disabled={state === "fetching" || state === "submitting" || !url.trim()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary-container hover:opacity-90 disabled:opacity-50"
          >
            {state === "fetching" ? "Fetching..." : "Fetch"}
          </button>
        </div>
      </form>

      <p className="mb-3 text-xs text-on-surface-variant">
        Paste a URL and we'll extract the content automatically.
      </p>

      {state === "error" && error && (
        <p className="mb-3 rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      {state === "preview" && (
        <form onSubmit={handleIngest}>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container px-3 py-1 text-xs font-medium text-secondary">
            Source: {sourceUrl} ({sourceType})
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-on-surface">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-on-surface">
              Document Type
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
            >
              {DOC_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-on-surface">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className={inputClass}
              required
            />
          </div>
          {error && (
            <p className="mb-3 rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-error">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={state === "submitting" || !title.trim() || !content.trim()}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary-container hover:opacity-90 disabled:opacity-50"
            >
              {state === "submitting" ? "Adding..." : "Add to Knowledge Base"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={state === "submitting"}
              className="rounded-full border border-outline-variant bg-surface-container px-5 py-2.5 text-sm font-medium text-on-surface transition-all hover:bg-surface-container-high disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
