interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({
  icon = "📄",
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="glass-card rounded-2xl py-12 text-center text-[var(--color-muted)]">
      <div className="mb-2 text-4xl">{icon}</div>
      <div className="font-medium text-[var(--color-charcoal)]">{title}</div>
      {description && <div className="mt-1 text-sm">{description}</div>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-[var(--color-brand-hover)]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
