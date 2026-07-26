import type { ReactNode } from "react";

interface IntegrationCardProps {
  title: string;
  description: string;
  connected: boolean;
  brandColor: string;
  icon: ReactNode;
  onAction: () => void;
  actionLabel: string;
  actionLoading?: boolean;
  children: ReactNode;
}

export function IntegrationCard({
  title,
  description,
  connected,
  brandColor,
  icon,
  onAction,
  actionLabel,
  actionLoading = false,
  children,
}: IntegrationCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--color-charcoal)]">{title}</h2>
            <p className="mt-0.5 text-sm text-[var(--color-muted)]">{description}</p>
          </div>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{
            backgroundColor: connected ? `${brandColor}20` : "var(--color-surface-alt)",
            color: connected ? brandColor : "var(--color-muted)",
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: connected ? brandColor : "var(--color-faint)" }}
          />
          {connected ? "Connected" : "Not Set Up"}
        </span>
      </div>

      <div className="mt-5">
        {connected ? (
          children
        ) : (
          <div className="py-4 text-center">
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors"
              style={{
                backgroundColor: brandColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              {icon}
              {actionLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
