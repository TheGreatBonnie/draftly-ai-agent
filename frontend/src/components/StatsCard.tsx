interface StatsCardProps {
  label: string;
  value: string | number;
  color?: string;
}

export function StatsCard({ label, value, color }: StatsCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-[var(--color-muted)] text-sm">{label}</div>
      <div
        className="mt-1 text-3xl font-bold"
        style={{ color: color ?? "var(--color-charcoal)" }}
      >
        {value}
      </div>
    </div>
  );
}
