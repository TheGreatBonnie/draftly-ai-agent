import { useNavigate } from "react-router";
import type { Doc } from "../api/types";
import { Badge } from "./Badge";
import { ConfidenceBar } from "./ConfidenceBar";

const DOC_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  troubleshooting: {
    bg: "var(--color-terracotta-light)",
    text: "var(--color-terracotta)",
  },
  howto: {
    bg: "var(--color-sage-light)",
    text: "var(--color-sage)",
  },
  reference: {
    bg: "var(--color-sand-light)",
    text: "var(--color-sand)",
  },
  guide: {
    bg: "var(--color-blue-50)",
    text: "var(--color-blue-600)",
  },
};

const DEFAULT_DOC_TYPE_COLOR = {
  bg: "var(--color-charcoal-light)",
  text: "var(--color-surface-alt)",
};

function getDocTypeColors(docType: string) {
  return DOC_TYPE_COLORS[docType] ?? DEFAULT_DOC_TYPE_COLOR;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface DocCardProps {
  doc: Doc;
}

export function DocCard({ doc }: DocCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/docs/${doc.id}`)}
      className="cursor-pointer rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow hover:shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            {(() => {
              const { bg, text } = getDocTypeColors(doc.doc_type);
              return (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: bg, color: text }}
                >
                  {doc.doc_type}
                </span>
              );
            })()}
            <span className="text-xs text-[var(--color-muted)]">
              v{doc.version} · {relativeTime(doc.created_at)}
            </span>
          </div>
          <h3 className="font-semibold text-[var(--color-charcoal)]">
            {doc.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
            {truncate(doc.content, 120)}
          </p>
        </div>
        <div className="ml-4 flex shrink-0 flex-col items-end gap-2">
          <Badge status={doc.status} />
          <div className="flex items-center gap-2">
            <ConfidenceBar score={doc.confidence_score} />
            <span className="text-xs text-[var(--color-muted)]">
              {Math.round(doc.confidence_score * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
