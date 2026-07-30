interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: string;
  color: "primary" | "secondary" | "tertiary";
}

const colorMap = {
  primary: { text: "text-primary", bg: "bg-primary/10" },
  secondary: { text: "text-secondary", bg: "bg-secondary/10" },
  tertiary: { text: "text-tertiary", bg: "bg-tertiary/10" },
};

export function MetricCard({ label, value, sublabel, icon, color }: MetricCardProps) {
  const c = colorMap[color];
  return (
    <div className={`bg-surface-container-low border border-outline-variant p-5 rounded-xl inner-glow-top flex items-center justify-between group transition-all hover:border-${color === 'primary' ? 'primary' : color === 'secondary' ? 'secondary' : 'tertiary'}/40`}>
      <div>
        <p className="text-[11px] font-mono text-on-surface-variant uppercase tracking-[0.12em] mb-1.5 font-medium">{label}</p>
        <h3 className={`text-[34px] font-bold leading-none tracking-tight ${c.text}`} style={{ fontFamily: "Inter" }}>{value}</h3>
        {sublabel && <p className="text-xs text-on-surface-variant/60 mt-1.5 font-mono">{sublabel}</p>}
      </div>
      <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center group-hover:bg-opacity-20 transition-all`}>
        <span className={`material-symbols-outlined ${c.text} text-[24px]`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
    </div>
  );
}
