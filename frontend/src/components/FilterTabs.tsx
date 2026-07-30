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
    <div className="flex gap-2 flex-wrap">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold font-mono transition-all ${
              isActive
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-surface-container-low border border-outline-variant text-on-surface-variant/60 hover:text-on-surface-variant hover:border-outline"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        );
      })}
    </div>
  );
}
