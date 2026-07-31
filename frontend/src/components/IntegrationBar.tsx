interface IntegrationBarProps {
  label: string;
  percent: number;
  color: "primary" | "secondary" | "tertiary";
  pulse?: boolean;
}

const fillMap = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
};

const dotMap = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
};

export type { IntegrationBarProps };

export function IntegrationBar({ label, percent, color, pulse }: IntegrationBarProps) {
  return (
    <div className="bg-surface-container/50 backdrop-blur-sm p-3.5 rounded-lg border border-outline-variant">
      <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dotMap[color]} ${pulse ? "pulse-ring" : ""} inline-block`}></span>
        {label}
      </p>
      <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
        <div className={`h-full ${fillMap[color]} rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
}
