import { useDashboardData } from "../hooks/useDashboardData";
import { MetricCard } from "../components/MetricCard";
import { EngineViz } from "../components/EngineViz";
import { IngestFeedItem } from "../components/IngestFeedItem";
import { KernelLog } from "../components/KernelLog";
import { StatsCard } from "../components/StatsCard";

const sampleTime = () => new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

function getEngineAnnotations(feed: { platform: string; summary: string }[], activeWorkflows: number) {
  if (activeWorkflows > 0) {
    const latest = feed.find((f) => f.platform !== "system");
    if (latest) {
      return {
        currentTask: `${latest.platform === "slack" ? "Ingesting" : "Processing"} ${latest.platform} activity`,
        nextTask: feed.length > 1 ? `Analyzing ${feed[1].summary?.slice(0, 40)}...` : null,
      };
    }
  }
  return { currentTask: "Waiting for activity...", nextTask: null };
}

export function Dashboard() {
  const {
    reviews, memoryStats, feed, platformCounts, activeWorkflows,
    slackConnected, githubConnected, discordConnected,
    loading, error, refetch,
  } = useDashboardData();

  const totalVectors = memoryStats
    ? (memoryStats.support_threads ?? 0) + (memoryStats.documentation ?? 0) + (memoryStats.embeddings ?? 0) +
      (memoryStats.review_sessions ?? 0) + (memoryStats.agent_memory ?? 0) + (memoryStats.audit_logs ?? 0)
    : 0;
  const pendingCount = reviews.filter((r) => r.status === "pending").length;
  const totalThreads = (memoryStats?.support_threads ?? 0) + (memoryStats?.review_sessions ?? 0);

  const pending = reviews.filter((r) => r.status === "pending").slice(0, 5);

  // Compute integration percentages from last 24h platform counts
  const totalActivity = Object.values(platformCounts).reduce<number>((a, b) => a + (b ?? 0), 0);
  const maxPct = 100;
  const slackPct = totalActivity > 0 ? Math.round(((platformCounts.slack ?? 0) / totalActivity) * maxPct) : 0;
  const githubPct = totalActivity > 0 ? Math.round(((platformCounts.github ?? 0) / totalActivity) * maxPct) : 0;
  const discordPct = totalActivity > 0 ? Math.round(((platformCounts.discord ?? 0) / totalActivity) * maxPct) : 0;
  const knowledgePct = totalActivity > 0 ? Math.round((1 - totalActivity / (totalActivity + 10)) * maxPct) : 0;

  // Engine load heuristic
  const loadPercent = `${activeWorkflows * 8 + (pendingCount > 0 ? 5 : 0) + (totalActivity > 0 ? 10 : 0)}%`;
  const threadsPerMin = `${Math.max(1, Math.round((totalThreads / 24) * (activeWorkflows + 1)))}/min`;

  const { currentTask, nextTask } = getEngineAnnotations(
    feed.slice(0, 5).map((f) => ({ platform: f.platform, summary: f.summary })),
    activeWorkflows,
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[110px] flex-1 bg-surface-container-low border border-outline-variant rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-[520px] bg-surface-container-low border border-outline-variant rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-[180px] bg-surface-container-low border border-outline-variant rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="material-symbols-outlined text-4xl text-error">error_outline</span>
        <p className="text-on-surface-variant">Failed to load command center data.</p>
        <p className="text-sm text-on-surface-variant/60">{error}</p>
        <button
          onClick={refetch}
          className="mt-2 rounded-full bg-primary/10 border border-primary/30 px-5 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-all active:scale-95"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-on-surface font-sans">Command Center</h1>
          <p className="text-sm text-on-surface-variant/70 font-mono mt-1">
            T: {sampleTime()} UTC — System Status:{" "}
            <span className="text-secondary font-semibold">NOMINAL</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant rounded-full px-4 py-2">
            <span className="w-2 h-2 rounded-full bg-secondary pulse-ring"></span>
            <span className="text-xs font-mono text-secondary font-semibold">AGENT ACTIVE</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <MetricCard
          label="Active Reviews"
          value={pendingCount}
          icon="rate_review"
          color="primary"
        />
        <MetricCard
          label="Memory Vectors"
          value={totalVectors.toLocaleString()}
          icon="memory"
          color="secondary"
        />
        <MetricCard
          label="Threads Ingested"
          value={totalThreads.toLocaleString()}
          sublabel="support + review sessions"
          icon="forum"
          color="tertiary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EngineViz
            integrations={[
              { label: "Slack", percent: slackConnected ? slackPct : 0, color: "primary", pulse: slackConnected },
              { label: "GitHub", percent: githubConnected ? githubPct : 0, color: "secondary", pulse: githubConnected },
              { label: "Discord", percent: discordConnected ? discordPct : 0, color: "tertiary", pulse: discordConnected },
              { label: "Knowledge", percent: knowledgePct, color: "primary", pulse: true },
            ]}
            activeWorkflows={activeWorkflows}
            loadPercent={loadPercent}
            threadsPerMin={threadsPerMin}
            currentTask={currentTask}
            nextTask={nextTask}
          />
        </div>
        <div className="lg:col-span-1 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col min-h-0 relative inner-glow-top">
          <div className="scanline opacity-10"></div>
          <div className="px-6 py-4 border-b border-outline-variant/40 flex items-center justify-between relative z-10 shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface font-sans">Ingest Feed</h2>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary pulse-ring inline-block"></span>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 scrollbar-thin min-h-0">
            {feed.length === 0 && (
              <p className="text-xs text-on-surface-variant/50 text-center py-8">No recent activity</p>
            )}
            {feed.map((item) => {
              const platform = (item.platform === "slack" || item.platform === "github" || item.platform === "discord")
                ? item.platform
                : "github";
              const status = item.action.includes("publish") ? "published" as const
                : item.action.includes("ingest") ? "analyzing" as const
                : "drafting" as const;
              return (
                <IngestFeedItem
                  key={item.id}
                  platform={platform}
                  channel={item.channel ?? item.source}
                  timestamp={new Date(item.created_at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
                  quote={item.summary}
                  status={status}
                />
              );
            })}
          </div>
        </div>
      </div>

      <KernelLog initialEntries={feed.slice(0, 15)} />

      {pending.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant font-sans">Action Required</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-mono font-bold">{pending.length}</span>
          </div>
          <div className="space-y-3">
            {pending.map((review) => (
              <StatsCard
                key={review.id}
                label={review.title}
                value={`${Math.round(review.confidence_score * 100)}%`}
                icon="rate_review"
                color="#c0c1ff"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
