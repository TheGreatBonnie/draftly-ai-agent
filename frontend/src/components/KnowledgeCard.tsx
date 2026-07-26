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
