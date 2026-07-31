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
      ? "bg-secondary/10 text-secondary"
      : delta < 0
        ? "bg-error-container/20 text-error"
        : "bg-surface-container text-on-surface-variant/60";

  return (
    <div className="mb-6 rounded-lg bg-surface-container p-4">
      <p className="mb-3 text-xs font-medium text-on-surface-variant">
        Confidence Score
      </p>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-[10px] uppercase text-on-surface-variant">Before</p>
          <p className="text-3xl font-bold text-on-surface">{beforePct}%</p>
        </div>
        <span className="text-xl text-on-surface-variant/40">→</span>
        <div className="text-center">
          <p className="text-[10px] uppercase text-on-surface-variant">After</p>
          <p className="text-3xl font-bold text-secondary">{afterPct}%</p>
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
