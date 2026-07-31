import type { KnowledgeDoc } from "../api/types";
import { Badge } from "./Badge";
import { truncate, relativeTime } from "../utils/format";

const DOC_TYPE_STYLES: Record<string, string> = {
  howto: "bg-secondary/10 text-secondary",
  faq: "bg-tertiary/10 text-on-surface",
  tutorial: "bg-primary/10 text-primary",
  troubleshooting: "bg-tertiary/10 text-tertiary",
  reference: "bg-surface-variant text-on-surface-variant",
};

interface KnowledgeCardProps {
  doc: KnowledgeDoc;
  onDelete: (id: string) => void;
}

export function KnowledgeCard({ doc, onDelete }: KnowledgeCardProps) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-on-surface">
            {doc.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-sm text-on-surface-variant">
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${DOC_TYPE_STYLES[doc.doc_type] ?? "bg-surface-variant text-on-surface-variant"}`}
            >
              {doc.doc_type}
            </span>
            <span>v{doc.version}</span>
            <span>·</span>
            <span>{relativeTime(doc.created_at)}</span>
          </div>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-on-surface-variant">
        {truncate(doc.content, 150)}
      </p>

      <div className="mt-3 flex items-center justify-between border-t border-outline-variant/40 pt-3">
        <div className="flex items-center gap-2.5">
          <Badge status={doc.status} />
          <span className="text-xs text-on-surface-variant">
            <strong className="text-on-surface">
              {Math.round(doc.confidence_score * 100)}%
            </strong>{" "}
            confidence
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDelete(doc.id)}
          className="rounded-full border border-error/30 bg-error-container/20 px-3 py-1 text-xs font-medium text-error transition-all hover:opacity-90"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
