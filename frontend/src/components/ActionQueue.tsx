import { Link } from "react-router";
import type { Review } from "../api/types";
import { relativeTime } from "../utils/format";

interface ActionQueueProps {
  reviews: Review[];
}

const DOC_TYPE_ICONS: Record<string, string> = {
  slack: "https://cdn.simpleicons.org/slack/4A154B",
  github: "https://cdn.simpleicons.org/github/24292e",
  discord: "https://cdn.simpleicons.org/discord/5865F2",
};

function getSourceIcon(docType: string): string {
  const lower = docType.toLowerCase();
  for (const [key, url] of Object.entries(DOC_TYPE_ICONS)) {
    if (lower.includes(key)) return url;
  }
  return "https://cdn.simpleicons.org/article/6b7280";
}

export function ActionQueue({ reviews }: ActionQueueProps) {
  const pending = reviews.filter((r) => r.status === "pending");
  const hasError = (r: Review) => r.content.includes("error") || r.content.includes("failed");

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2
          className="text-xl font-bold text-[var(--color-charcoal)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Action Required
        </h2>
        <span className="rounded-full bg-[var(--color-sand-light)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--color-charcoal)]">
          {pending.length} Pending
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-white/50 p-8 text-center">
            <p className="text-sm text-[var(--color-muted)]">No pending reviews</p>
          </div>
        ) : (
          pending.map((review) => {
            const isError = hasError(review);
            return (
              <div
                key={review.id}
                className={`card-hover group flex items-center justify-between rounded-2xl border bg-white/60 p-5 ${
                  isError
                    ? "border-red-200/50 hover:border-red-300"
                    : "border-[var(--color-border)]"
                }`}
              >
                {isError && (
                  <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-red-400" />
                )}
                <div className={`flex items-start gap-4 ${isError ? "pl-2" : ""}`}>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm">
                    <img
                      alt={review.doc_type}
                      className={`h-6 w-6 ${isError ? "grayscale opacity-50" : ""}`}
                      src={getSourceIcon(review.doc_type)}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-1 text-base font-semibold text-[var(--color-charcoal)] group-hover:text-[var(--color-brand)] transition-colors">
                      {review.title}
                    </h3>
                    {isError ? (
                      <>
                        <p className="mb-1 flex items-center gap-1 text-sm font-medium text-red-500/80">
                          <span className="material-symbols-outlined text-[16px]">error</span>
                          Connection lost during drafting
                        </p>
                        <p className="text-xs text-[var(--color-muted)]">
                          Partial draft saved. Please review manually.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mb-2 line-clamp-1 text-sm text-[var(--color-muted)]">
                          {review.content.slice(0, 100)}...
                        </p>
                        <span className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-white/60 px-2 py-0.5 text-[11px] font-medium text-[var(--color-charcoal)]">
                          <span className="material-symbols-outlined text-[14px]">psychology</span>
                          AI Confidence: {Math.round(review.confidence_score * 100)}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Link
                  to={`/review/${review.id}`}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-md transition-all active:scale-95 ${
                    isError
                      ? "border border-gray-200 bg-white text-[var(--color-charcoal)] hover:border-gray-300 hover:shadow"
                      : "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] hover:shadow-lg"
                  }`}
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {isError ? "Fix Issue" : "Review"}
                  {!isError && (
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  )}
                </Link>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
