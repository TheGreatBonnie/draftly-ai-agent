interface LogEntry {
  time: string;
  level: "SUCCESS" | "INFO" | "SYNC" | "IDLE";
  message: string;
}

const DEFAULT_LOGS: LogEntry[] = [
  { time: "14:22:05", level: "SUCCESS", message: "All integrations connected and monitoring." },
  { time: "14:22:12", level: "INFO", message: "GitHub Webhook active. Listening for PR events." },
  { time: "14:22:18", level: "SYNC", message: "Slack channel mapping synchronized." },
  { time: "14:23:45", level: "IDLE", message: "Monitoring 3 sources. No new delta detected." },
];

const LEVEL_STYLES: Record<LogEntry["level"], string> = {
  SUCCESS: "text-secondary",
  INFO: "text-primary",
  SYNC: "text-secondary",
  IDLE: "text-tertiary",
};

export function LogStream() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
      <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-container">
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h2 className="font-mono text-sm text-on-surface uppercase tracking-wider">
            Live Agent Log Stream
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[10px] font-mono text-on-surface-variant flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            ENGINE_STABLE
          </div>
          <div className="w-px h-4 bg-outline-variant" />
          <button
            type="button"
            className="text-[10px] font-mono text-primary hover:underline"
            onClick={() => {}}
          >
            CLEAR_LOGS
          </button>
        </div>
      </div>
      <div className="p-6 font-mono text-xs text-on-surface-variant space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
        {DEFAULT_LOGS.map((log, i) => (
          <div key={i} className="flex gap-4">
            <span className="text-outline shrink-0">{log.time}</span>
            <span className={`${LEVEL_STYLES[log.level]} shrink-0`}>
              [{log.level}]
            </span>
            <span className={log.level === "IDLE" ? "text-on-surface-variant" : "text-on-surface"}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
