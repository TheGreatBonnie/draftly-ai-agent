import { useEffect, useState } from "react";
import {
  listKnowledge,
  ingestKnowledge,
  deleteKnowledge,
} from "../api/knowledge";
import type { KnowledgeDoc, IngestKnowledgePayload } from "../api/types";
import { Badge } from "../components/Badge";
import { URLImportForm } from "../components/URLImportForm";

const DOC_TYPES = ["howto", "faq", "tutorial", "troubleshooting", "reference"] as const;

export function Knowledge() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<string>("reference");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDocs() {
    try {
      const data = await listKnowledge();
      setDocs(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocs();
  }, []);

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: IngestKnowledgePayload = { title, content, doc_type: docType };
      await ingestKnowledge(payload);
      setTitle("");
      setContent("");
      setDocType("reference");
      await loadDocs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to ingest document");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(docId: string) {
    try {
      await deleteKnowledge(docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Knowledge Base</h1>
      <p className="mb-6 text-sm text-gray-500">
        Add company documentation so the AI uses it as context when generating solutions.
      </p>

      <URLImportForm onIngested={loadDocs} />

      <form onSubmit={handleIngest} className="mb-8 rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 text-lg font-semibold">Add Manually</h2>
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Internal API Auth Guide"
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
            placeholder="Paste or write your documentation here..."
            rows={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !title.trim() || !content.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add to Knowledge Base"}
        </button>
      </form>

      <h2 className="mb-3 text-lg font-semibold">
        Company Documents ({docs.length})
      </h2>
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : docs.length === 0 ? (
        <p className="text-gray-500">No documents yet. Add one above.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((doc) => (
            <div key={doc.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {doc.doc_type} · v{doc.version} ·{" "}
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={doc.status} />
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <button
                onClick={() => setExpanded(expanded === doc.id ? null : doc.id)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                {expanded === doc.id ? "Collapse" : "Expand"}
              </button>
              {expanded === doc.id && (
                <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-700">
                  {doc.content}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
