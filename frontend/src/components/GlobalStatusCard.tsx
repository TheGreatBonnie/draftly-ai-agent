interface GlobalStatusCardProps {
  sourceCount: number;
}

export function GlobalStatusCard({ sourceCount }: GlobalStatusCardProps) {
  return (
    <div className="bg-surface-container-high border border-outline-variant p-6 rounded-xl flex items-center gap-6 min-w-[320px] relative overflow-hidden">
      <div className="absolute top-0 right-0 p-1 opacity-10 pointer-events-none">
        <svg className="w-20 h-20 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
      <div className="relative z-10 w-3 h-3 bg-secondary rounded-full shadow-[0_0_8px_rgba(78,222,163,0.6)] before:content-[''] before:absolute before:w-[300%] before:h-[300%] before:left-[-100%] before:top-[-100%] before:rounded-full before:bg-secondary/40 before:animate-ping" />
      <div className="relative z-10">
        <div className="text-label-sm font-mono text-on-surface-variant uppercase tracking-widest mb-1">
          Global Agent Status
        </div>
        <div className="text-headline-lg text-secondary">
          Watching <span className="font-mono">{sourceCount}</span> Sources
        </div>
        <div className="flex gap-2 mt-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-secondary/30 text-secondary bg-secondary/10">
            INGEST_ON
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-outline-variant text-on-surface-variant bg-surface-variant/30">
            MONITOR_ACTIVE
          </span>
        </div>
      </div>
    </div>
  );
}
