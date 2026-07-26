interface StatusOverviewProps {
  github: boolean;
  slack: boolean;
  discord: boolean;
}

interface StatusCardProps {
  name: string;
  connected: boolean;
  brandColor: string;
}

function StatusCard({ name, connected, brandColor }: StatusCardProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: connected ? brandColor : "var(--color-faint)" }}
        />
        <span className="font-medium text-[var(--color-charcoal)]">{name}</span>
      </div>
      <p className="mt-1 pl-5 text-xs text-[var(--color-muted)]">
        {connected ? "Connected" : "Not Set Up"}
      </p>
    </div>
  );
}

export function StatusOverview({ github, slack, discord }: StatusOverviewProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatusCard name="GitHub" connected={github} brandColor="#16a34a" />
      <StatusCard name="Slack" connected={slack} brandColor="#9333ea" />
      <StatusCard name="Discord" connected={discord} brandColor="#4f46e5" />
    </div>
  );
}
