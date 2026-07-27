interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  trend?: { value: string; positive: boolean };
}

export function StatsCard({ label, value, icon, color, trend }: StatsCardProps) {
  return (
    <div className="glass-card flex h-[140px] flex-col justify-between rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-[var(--color-muted)]">{label}</p>
        {icon && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              backgroundColor: color ? `${color}20` : "var(--color-mint-light)",
              color: color ?? "var(--color-mint)",
            }}
          >
            <span className="material-symbols-outlined text-lg">{icon}</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <h3 className="text-[32px] font-bold leading-none text-[var(--color-charcoal)]">
          {value}
        </h3>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-sm font-semibold ${
              trend.positive ? "text-[var(--color-mint)]" : "text-red-500"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {trend.positive ? "trending_up" : "trending_down"}
            </span>{" "}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
