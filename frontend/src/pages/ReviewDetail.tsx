import { useEffect, useRef, useState } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getDoc } from "../api/docs";
import { getReview, decideReview } from "../api/reviews";
import type { Doc } from "../api/types";
import { DocTOC } from "../components/DocTOC";
import { DocMetadata } from "../components/DocMetadata";
import { ReviewForm } from "../components/ReviewForm";
import { ConfidenceComparison } from "../components/ConfidenceComparison";
import { formatDate } from "../utils/format";

interface DetailData {
  title: string;
  content: string;
  doc_type: string;
  confidence_score: number;
  original_question: string | null;
  platform: string | null;
  version?: number;
  updated_at?: string;
  created_at?: string;
  status?: string;
  confidence_before?: number | null;
  confidence_after?: number | null;
  reviewer_feedback?: string | null;
}

const PLATFORM_SVG: Record<string, { label: string; color: string }> = {
  slack: { label: "Slack", color: "text-purple-600" },
  discord: { label: "Discord", color: "text-indigo-600" },
  github: { label: "GitHub", color: "text-gray-600" },
};

export function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isReviewSession = location.pathname.startsWith("/review/");

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchData = isReviewSession ? getReview(id) : getDoc(id);

    fetchData
      .then((result) => {
        if (result && "error" in result) {
          setError((result as { error: string }).error);
        } else {
          setData(result as DetailData);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isReviewSession]);

  const handleDecision = async (
    decision: "approve" | "reject" | "revise",
    feedback: string,
  ) => {
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      await decideReview(id, { decision, feedback });
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.content);
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!data) return;
    const blob = new Blob([data.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title.toLowerCase().replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const platform = data?.platform
    ? PLATFORM_SVG[data.platform.toLowerCase()]
    : null;

  const backLink = isReviewSession ? "/dashboard" : "/reviews";
  const backLabel = isReviewSession ? "Back to Dashboard" : "Back to Reviews";

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-6 w-48 animate-pulse rounded-full bg-white/60" />
        <div className="glass-card h-8 w-96 animate-pulse rounded-2xl" />
        <div className="glass-card h-64 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-muted)]">
          {error ?? "Document not found."}
        </p>
        <Link
          to={backLink}
          className="mt-3 inline-block rounded-full bg-[var(--color-charcoal)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          {backLabel}
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-muted)]">Document not found.</p>
        <Link
          to={backLink}
          className="mt-3 inline-block rounded-full bg-[var(--color-charcoal)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          {backLabel}
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
            to={backLink}
            className="text-sm font-medium text-[var(--color-brand)] hover:underline"
          >
            &larr; {backLabel}
          </Link>
        </div>

        <div className="glass-card mb-6 rounded-2xl p-5">
          <h1 className="text-[22px] font-bold leading-tight text-[var(--color-charcoal)]">
            {data.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[var(--color-sage-light)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-sage)]">
              {data.doc_type}
            </span>
            {data.status && (
              <span className="rounded-full bg-[var(--color-sage-light)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-sage)]">
                {data.status}
              </span>
            )}
            {platform && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/60 px-2.5 py-0.5 text-[11px] font-semibold">
                <span className={`material-symbols-outlined text-[14px] ${platform.color}`}>
                  {platform.label === "Slack" ? "chat" : platform.label === "Discord" ? "forum" : "code"}
                </span>
                {platform.label}
              </span>
            )}
            <span className="text-xs text-[var(--color-muted)]">
              {data.version != null && `Version ${data.version} · `}
              Updated {formatDate(data.updated_at ?? data.created_at ?? "")}
            </span>
          </div>
          {data.original_question && (
            <div className="mt-3 rounded-xl border border-white/60 bg-white/40 px-4 py-3">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[12px] text-[var(--color-muted)]">
                  help
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Original Question
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[var(--color-charcoal-light)]">
                &ldquo;{data.original_question}&rdquo;
              </p>
            </div>
          )}
        </div>

        {isReviewSession && (
          <ConfidenceComparison
            before={data.confidence_before ?? null}
            after={data.confidence_after ?? null}
          />
        )}

        {isReviewSession && data.reviewer_feedback && (
          <div className="glass-card mb-6 rounded-2xl p-5">
            <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
              Reviewer Feedback
            </p>
            <p className="text-sm text-[var(--color-charcoal)]">
              {data.reviewer_feedback}
            </p>
          </div>
        )}

        <div className="glass-card mb-6 rounded-2xl p-6">
          <article className="prose">
            <Markdown remarkPlugins={[remarkGfm]}>{data.content}</Markdown>
          </article>
        </div>

        {isReviewSession && data.status === "pending" && (
          <div className="mt-8">
            <ReviewForm onSubmit={handleDecision} isSubmitting={submitting} error={error} />
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="glass-panel w-[200px] shrink-0 rounded-2xl py-5 pl-5">
        <DocTOC content={data.content} />

        <div className="border-t border-white/40 pt-5">
          <DocMetadata doc={data as Doc} />
        </div>

        <div className="border-t border-white/40 pt-5">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
            Actions
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-white/60 bg-white/40 px-3 py-1.5 text-left text-[11px] font-medium text-[var(--color-charcoal)] transition-all hover:bg-white/60"
            >
              {copied ? "Copied!" : "Copy content"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-full border border-white/60 bg-white/40 px-3 py-1.5 text-left text-[11px] font-medium text-[var(--color-charcoal)] transition-all hover:bg-white/60"
            >
              Download as Markdown
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
