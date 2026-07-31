export function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "bg-secondary"
      : pct >= 50
        ? "bg-tertiary"
        : "bg-error";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-outline-variant/40">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-on-surface-variant/60">{pct}%</span>
    </div>
  );
}
