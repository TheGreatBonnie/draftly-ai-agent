interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  trend?: { value: string; positive: boolean };
}

export function StatsCard({ label, value, icon, color, trend }: StatsCardProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 flex flex-col justify-between gap-3 inner-glow-top transition-all hover:border-primary/30">
      <div className="flex items-start justify-between">
        <p className="text-xs text-on-surface-variant font-mono uppercase tracking-wider">{label}</p>
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: color ? `${color}20` : "transparent",
              color: color ?? "var(--color-primary)",
            }}
          >
            <span className="material-symbols-outlined text-lg">{icon}</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <h3 className="text-[28px] font-bold leading-none tracking-tight text-on-surface font-sans">
          {value}
        </h3>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend.positive ? "text-secondary" : "text-error"}`}>
            <span className="material-symbols-outlined text-[14px]">
              {trend.positive ? "trending_up" : "trending_down"}
            </span>
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
