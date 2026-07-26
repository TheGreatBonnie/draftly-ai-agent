import { useNavigate } from "react-router";
import type { Doc } from "../api/types";
import { Badge } from "./Badge";
import { ConfidenceBar } from "./ConfidenceBar";

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
            <span className="rounded-full bg-[var(--color-sage-light)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--color-sage)]">
              {doc.doc_type}
            </span>
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
