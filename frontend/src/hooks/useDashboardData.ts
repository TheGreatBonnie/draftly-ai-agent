import { useEffect, useState } from "react";
import { getAllReviews } from "../api/reviews";
import { getMemoryStats } from "../api/memory";
import { listSlackInstallations } from "../api/slack";
import { listInstallations } from "../api/github";
import { getDiscordStatus } from "../api/discord";
import { getActivityFeed } from "../api/activity";
import type { Review, MemoryStats, ActivityEvent, PlatformCounts } from "../api/types";

export interface DashboardData {
  reviews: Review[];
  memoryStats: MemoryStats | null;
  feed: ActivityEvent[];
  platformCounts: PlatformCounts;
  activeWorkflows: number;
  slackConnected: boolean;
  githubConnected: boolean;
  discordConnected: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const EMPTY_PLATFORM_COUNTS: PlatformCounts = {};

export function useDashboardData(): DashboardData {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [feed, setFeed] = useState<ActivityEvent[]>([]);
  const [platformCounts, setPlatformCounts] = useState<PlatformCounts>(EMPTY_PLATFORM_COUNTS);
  const [activeWorkflows, setActiveWorkflows] = useState(0);
  const [slackConnected, setSlackConnected] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      getAllReviews(),
      getMemoryStats(),
      getActivityFeed(8),
      listSlackInstallations().catch(() => []),
      listInstallations().catch(() => []),
      getDiscordStatus().catch(() => ({ connected: false })),
    ])
      .then(([reviewsData, stats, feedData, slackInstalls, githubInstalls, discordStatus]) => {
        setReviews(reviewsData);
        setMemoryStats(stats);
        setFeed(feedData);
        setPlatformCounts(stats?.platform_counts ?? {});
        setActiveWorkflows(stats?.active_workflows ?? 0);
        setSlackConnected(slackInstalls.length > 0);
        setGithubConnected(githubInstalls.length > 0);
        setDiscordConnected(discordStatus.connected);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  return {
    reviews, memoryStats, feed, platformCounts, activeWorkflows,
    slackConnected, githubConnected, discordConnected,
    loading, error, refetch: fetch,
  };
}
