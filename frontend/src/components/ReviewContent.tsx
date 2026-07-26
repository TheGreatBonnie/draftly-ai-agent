import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReviewContentProps {
  content: string;
}

export function ReviewContent({ content }: ReviewContentProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-charcoal)]">
        Documentation
      </h2>
      <div className="prose prose-warm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
