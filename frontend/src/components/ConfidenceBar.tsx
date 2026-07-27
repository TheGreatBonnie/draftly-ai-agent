export function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "bg-[var(--color-sage)]"
      : pct >= 50
        ? "bg-[var(--color-sand)]"
        : "bg-red-400";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-[var(--color-border)]">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-[var(--color-muted)]">{pct}%</span>
    </div>
  );
}
