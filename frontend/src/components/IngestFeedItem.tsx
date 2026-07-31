interface IngestFeedItemProps {
  platform: "slack" | "github" | "discord";
  channel: string;
  timestamp: string;
  quote: string;
  status: "analyzing" | "published" | "drafting";
}

const platformConfig = {
  slack: { bg: "bg-[#4A154B]", icon: "S" },
  github: { bg: "bg-white", icon: "G" },
  discord: { bg: "bg-[#5865F2]", icon: "D" },
};

const statusConfig = {
  analyzing: { bg: "bg-primary-container text-on-primary-container" },
  published: { bg: "bg-secondary/15 text-secondary" },
  drafting: { bg: "bg-tertiary/15 text-tertiary" },
};

const borderHover: Record<string, string> = {
  slack: "hover:border-primary/50",
  github: "hover:border-secondary/50",
  discord: "hover:border-tertiary/50",
};

export function IngestFeedItem({ platform, channel, timestamp, quote, status }: IngestFeedItemProps) {
  const pf = platformConfig[platform];
  const sc = statusConfig[status];
  return (
    <div className={`group bg-surface-container-lowest p-3.5 rounded-lg border border-outline-variant transition-all cursor-pointer ${borderHover[platform]}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg ${pf.bg} flex items-center justify-center shrink-0 shadow-sm`}>
          <span className="text-xs font-bold text-black">{pf.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <span className="text-xs font-semibold text-on-surface font-sans">{channel}</span>
            <span className="text-[10px] font-mono text-on-surface-variant/60">{timestamp}</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 mb-2 font-sans">&ldquo;{quote}&rdquo;</p>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono ${sc.bg}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>
      </div>
    </div>
  );
}
