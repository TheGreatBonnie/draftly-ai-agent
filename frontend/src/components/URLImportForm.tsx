import { useState } from "react";
import { fetchUrlContent, ingestKnowledge } from "../api/knowledge";
import type { IngestKnowledgePayload } from "../api/types";

const DOC_TYPES = ["howto", "faq", "tutorial", "troubleshooting", "reference"] as const;

interface URLImportFormProps {
  onIngested: () => void;
}

type FormState = "idle" | "fetching" | "preview" | "submitting" | "error";

export function URLImportForm({ onIngested }: URLImportFormProps) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<string>("reference");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [error, setError] = useState("");

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
    <div className="mb-8 rounded-lg border border-gray-200 p-4">
      <h2 className="mb-3 text-lg font-semibold">Import from URL</h2>

      <form onSubmit={handleFetch}>
        <div className="mb-3 flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.example.com/api-guide"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={state === "fetching" || state === "submitting"}
            required
          />
          <button
            type="submit"
            disabled={state === "fetching" || state === "submitting" || !url.trim()}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
          >
            {state === "fetching" ? "Fetching..." : "Fetch"}
          </button>
        </div>
      </form>

      {state === "error" && error && (
        <p className="mb-3 text-sm text-red-600">{error}</p>
      )}

      {state === "preview" && (
        <form onSubmit={handleIngest}>
          <div className="mb-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Source: {sourceUrl} ({sourceType})
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {DOC_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={state === "submitting" || !title.trim() || !content.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {state === "submitting" ? "Adding..." : "Add to Knowledge Base"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={state === "submitting"}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
