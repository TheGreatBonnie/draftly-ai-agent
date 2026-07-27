interface Tab {
  key: string;
  label: string;
  count: number;
}

interface FilterTabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export function FilterTabs({ tabs, active, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-[var(--color-charcoal)] text-white shadow-sm"
                : "border border-white/60 bg-white/40 text-[var(--color-muted)] hover:bg-white/60 hover:text-[var(--color-charcoal)]"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        );
      })}
    </div>
  );
}
