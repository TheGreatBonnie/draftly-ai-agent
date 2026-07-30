interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = "inbox", title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl py-12 px-6 text-center">
      <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3 inline-block">{icon}</span>
      <p className="font-semibold text-on-surface font-sans">{title}</p>
      {description && <p className="mt-1.5 text-sm text-on-surface-variant/60">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 rounded-full bg-primary/10 border border-primary/30 px-5 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-all active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
