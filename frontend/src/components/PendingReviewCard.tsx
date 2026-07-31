import { Link } from "react-router";
import type { Review } from "../api/types";
import { Badge } from "./Badge";
import { relativeTime, truncate } from "../utils/format";

function SlackIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const PLATFORM_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  slack: {
    label: "Slack",
    icon: <SlackIcon />,
    className: "platform-slack",
  },
  discord: {
    label: "Discord",
    icon: <DiscordIcon />,
    className: "platform-discord",
  },
  github: {
    label: "GitHub",
    icon: <GitHubIcon />,
    className: "platform-github",
  },
};

interface PendingReviewCardProps {
  review: Review;
}

export function PendingReviewCard({ review }: PendingReviewCardProps) {
  const platform = review.platform
    ? PLATFORM_CONFIG[review.platform.toLowerCase()]
    : null;

  return (
    <Link
      to={`/review/${review.id}`}
      className="glass-card group block cursor-pointer rounded-2xl p-5"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <span className="material-symbols-outlined text-[24px] text-primary">
            rate_review
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-primary">
              {review.doc_type}
            </span>
            <Badge status={review.status} />
            <span className="text-[11px] font-mono text-on-surface-variant/60">
              {relativeTime(review.created_at)}
            </span>
          </div>

          <h3 className="mb-1 font-semibold text-on-surface group-hover:text-primary transition-colors">
            {review.title}
          </h3>

          {review.original_question && (
            <div className="mb-2 rounded-lg bg-surface-container border border-outline-variant px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[12px] text-on-surface-variant/60">
                  help
                </span>
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-on-surface-variant/60">
                  Original Question
                </span>
              </div>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                &ldquo;{truncate(review.original_question, 140)}&rdquo;
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            {platform && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-mono font-semibold ${platform.className}`}
              >
                {platform.icon}
                {platform.label}
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-secondary/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-secondary">
              <span className="material-symbols-outlined text-[14px]">
                psychology
              </span>
              {Math.round(review.confidence_score * 100)}%
            </span>
          </div>
        </div>

        <button className="shrink-0 rounded-lg bg-primary text-on-primary-container px-5 py-2.5 text-xs font-mono font-bold transition-all hover:shadow-[0_0_8px_rgba(192,193,255,0.3)] active:scale-95">
          View
        </button>
      </div>
    </Link>
  );
}
