import type { Doc } from "../api/types";
import { Badge } from "./Badge";
import { ConfidenceBar } from "./ConfidenceBar";
import { formatDate } from "../utils/format";

interface DocMetadataProps {
  doc: Doc;
}

export function DocMetadata({ doc }: DocMetadataProps) {
  return (
    <div>
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/40">
        Document Info
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1 text-[10px] text-on-surface-variant/40">
            Confidence
          </div>
          <div className="flex items-center gap-2">
            <ConfidenceBar score={doc.confidence_score} />
            <span className="text-xs font-semibold text-on-surface">
              {Math.round(doc.confidence_score * 100)}%
            </span>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] text-on-surface-variant/40">
            Version
          </div>
          <div className="text-xs text-on-surface">
            {doc.version}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] text-on-surface-variant/40">
            Created
          </div>
          <div className="text-xs text-on-surface">
            {formatDate(doc.created_at)}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] text-on-surface-variant/40">
            Updated
          </div>
          <div className="text-xs text-on-surface">
            {formatDate(doc.updated_at)}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] text-on-surface-variant/40">
            Status
          </div>
          <Badge status={doc.status} />
        </div>
      </div>
    </div>
  );
}
