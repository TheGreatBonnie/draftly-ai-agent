interface ConfidenceComparisonProps {
  before: number | null;
  after: number | null;
}

export function ConfidenceComparison({ before, after }: ConfidenceComparisonProps) {
  if (before === null || after === null) {
    return null;
  }

  const beforePct = Math.round(before * 100);
  const afterPct = Math.round(after * 100);
  const delta = afterPct - beforePct;
  const deltaClass =
    delta > 0
      ? "bg-[var(--color-sage-light)] text-[var(--color-sage)]"
      : delta < 0
        ? "bg-red-100 text-red-600"
        : "bg-[var(--color-surface-alt)] text-[var(--color-muted)]";

  return (
    <div className="mb-6 rounded-lg bg-[var(--color-surface-alt)] p-4">
      <p className="mb-3 text-xs font-medium text-[var(--color-muted)]">
        Confidence Score
      </p>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-[10px] uppercase text-[var(--color-muted)]">Before</p>
          <p className="text-3xl font-bold text-[var(--color-charcoal)]">{beforePct}%</p>
        </div>
        <span className="text-xl text-[var(--color-faint)]">→</span>
        <div className="text-center">
          <p className="text-[10px] uppercase text-[var(--color-muted)]">After</p>
          <p className="text-3xl font-bold text-[var(--color-sage)]">{afterPct}%</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${deltaClass}`}
        >
          {delta > 0 ? "+" : ""}
          {delta}%
        </span>
      </div>
    </div>
  );
}
