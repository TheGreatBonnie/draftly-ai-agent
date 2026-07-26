import type { Doc } from "../api/types";
import { Badge } from "./Badge";
import { ConfidenceBar } from "./ConfidenceBar";

interface DocMetadataProps {
  doc: Doc;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DocMetadata({ doc }: DocMetadataProps) {
  return (
    <div>
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
        Document Info
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1 text-[10px] text-[var(--color-faint)]">
            Confidence
          </div>
          <div className="flex items-center gap-2">
            <ConfidenceBar score={doc.confidence_score} />
            <span className="text-xs font-semibold text-[var(--color-charcoal)]">
              {Math.round(doc.confidence_score * 100)}%
            </span>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] text-[var(--color-faint)]">
            Version
          </div>
          <div className="text-xs text-[var(--color-charcoal)]">
            {doc.version}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] text-[var(--color-faint)]">
            Created
          </div>
          <div className="text-xs text-[var(--color-charcoal)]">
            {formatDate(doc.created_at)}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] text-[var(--color-faint)]">
            Updated
          </div>
          <div className="text-xs text-[var(--color-charcoal)]">
            {formatDate(doc.updated_at)}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] text-[var(--color-faint)]">
            Status
          </div>
          <Badge status={doc.status} />
        </div>
      </div>
    </div>
  );
}
