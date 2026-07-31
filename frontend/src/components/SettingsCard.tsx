import type { ReactNode } from "react";

interface ToggleFeature {
  label: string;
  sublabel: string;
  enabled: boolean;
}

interface SettingsCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  id: string;
  connected: boolean;
  features: ToggleFeature[];
  actionLabel: string;
  onAction: () => void;
  children?: ReactNode;
}

export function SettingsCard({
  icon,
  title,
  description,
  id,
  connected,
  features,
  actionLabel,
  onAction,
  children,
}: SettingsCardProps) {
  const inactive = !connected;
  return (
    <div
      className={`group bg-surface-container border border-outline-variant hover:border-primary/50 transition-all duration-300 rounded-xl overflow-hidden flex flex-col ${
        inactive ? "opacity-60 grayscale-[0.5]" : ""
      }`}
    >
      {/* Header */}
      <div className="p-6 border-b border-outline-variant/30 flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-lg border border-outline-variant flex items-center justify-center p-2 [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain">
            {icon}
          </div>
          <div>
            <h3 className="text-on-surface font-bold text-lg">{title}</h3>
            <span className="text-[10px] font-mono text-on-surface-variant">ID: {id}</span>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${
            connected
              ? "bg-secondary-container text-on-secondary-container"
              : "bg-surface-variant text-on-surface-variant border border-outline-variant"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? "bg-white animate-pulse" : "bg-on-surface-variant/50"
            }`}
          />
          {connected ? "Connected" : "Inactive"}
        </span>
      </div>

      {/* Body */}
      <div className={`p-6 space-y-6 flex-1 ${inactive ? "pointer-events-none" : ""}`}>
        <p className="text-body-md text-on-surface-variant leading-relaxed">
          {description}
        </p>
        <div className="space-y-4">
          {features.map((feature) => (
            <div key={feature.label} className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-on-surface">
                  {feature.label}
                </span>
                <span className="text-xs text-on-surface-variant">
                  {feature.sublabel}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={feature.enabled}
                  readOnly
                  aria-label={"Toggle " + feature.label}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
              </label>
            </div>
          ))}
        </div>

        {connected && children && (
          <div className="pt-2 border-t border-outline-variant/20">
            {children}
          </div>
        )}
      </div>

      {/* Footer */}
      <button
        type="button"
        onClick={onAction}
        className={`p-4 border-t border-outline-variant/30 transition-all flex justify-center items-center gap-2 text-sm font-bold ${
          connected
            ? "bg-surface-container-low hover:bg-surface-variant text-primary"
            : "bg-surface-container-low hover:bg-primary hover:text-on-primary group-hover:bg-primary group-hover:text-on-primary text-on-surface-variant"
        }`}
      >
        {actionLabel}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
