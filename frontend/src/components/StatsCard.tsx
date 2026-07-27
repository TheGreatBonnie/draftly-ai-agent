interface StatsCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: string;
}

export function StatsCard({ label, value, icon, color, trend }: StatsCardProps) {
  return (
    <div className="card-hover rounded-2xl border border-[var(--color-border)] bg-white/70 p-5">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-[var(--color-muted)]">
          {label}
        </span>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}20` }}
        >
          <span className="material-symbols-outlined text-lg" style={{ color }}>
            {icon}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className="text-[32px] font-bold leading-none"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-charcoal)" }}
        >
          {value}
        </span>
        {trend && (
          <span className="flex items-center text-sm font-medium text-[var(--color-sage)]">
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
