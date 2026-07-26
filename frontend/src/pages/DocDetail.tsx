import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getDoc } from "../api/docs";
import type { Doc } from "../api/types";
import { DocTOC } from "../components/DocTOC";
import { DocMetadata } from "../components/DocMetadata";
import { formatDate } from "../utils/format";

export function DocDetail() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    getDoc(id)
      .then(setDoc)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCopy = async () => {
    if (!doc) return;
    await navigator.clipboard.writeText(doc.content);
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!doc) return;
    const blob = new Blob([doc.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.toLowerCase().replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-6 w-48 animate-pulse rounded bg-[var(--color-border)]" />
        <div className="h-8 w-96 animate-pulse rounded bg-[var(--color-border)]" />
        <div className="h-64 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-muted)]">
          {error ?? "Document not found."}
        </p>
        <Link
          to="/docs"
          className="mt-3 inline-block rounded-lg bg-[var(--color-charcoal)] px-4 py-2 text-sm font-medium text-[var(--color-surface)] hover:opacity-90"
        >
          Back to Documentation
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pr-8">
        <div className="mb-6">
          <Link
            to="/docs"
            className="text-sm font-medium text-[var(--color-brand)] hover:underline"
          >
            ← Back to Documentation
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-[22px] font-bold leading-tight text-[var(--color-charcoal)]">
            {doc.title}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="rounded-full bg-[var(--color-sage-light)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-sage)]">
              {doc.doc_type}
            </span>
            <span className="rounded-full bg-[var(--color-sage-light)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-sage)]">
              {doc.status}
            </span>
            <span className="text-xs text-[var(--color-muted)]">
              Version {doc.version} · Updated{" "}
              {formatDate(doc.updated_at)}
            </span>
          </div>
        </div>

        <article className="prose">
          <Markdown remarkPlugins={[remarkGfm]}>{doc.content}</Markdown>
        </article>
      </div>

      {/* Right Sidebar */}
      <div className="w-[200px] shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)] py-5 pl-5">
        <DocTOC content={doc.content} />

        <div className="border-t border-[var(--color-border)] pt-5">
          <DocMetadata doc={doc} />
        </div>

        <div className="border-t border-[var(--color-border)] pt-5">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
            Actions
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-left text-[11px] font-medium text-[var(--color-charcoal)] transition-colors hover:border-[var(--color-charcoal)]"
            >
              {copied ? "Copied!" : "Copy content"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-left text-[11px] font-medium text-[var(--color-charcoal)] transition-colors hover:border-[var(--color-charcoal)]"
            >
              Download as Markdown
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
