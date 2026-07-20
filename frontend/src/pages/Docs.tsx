import { useEffect, useState } from "react";
import { listDocs } from "../api/docs";
import type { Doc } from "../api/types";
import { Badge } from "../components/Badge";
import { ConfidenceBar } from "../components/ConfidenceBar";

export function Docs() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    listDocs()
      .then(setDocs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-gray-500">Loading documentation...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Documentation ({docs.length})</h1>
      {docs.length === 0 ? (
        <p className="text-gray-500">No documentation yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {doc.doc_type} · v{doc.version} ·{" "}
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge status={doc.status} />
              </div>
              <div className="mt-2">
                <ConfidenceBar score={doc.confidence_score} />
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
