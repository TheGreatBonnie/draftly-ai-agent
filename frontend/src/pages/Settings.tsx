import { useCallback, useEffect, useState } from "react";
import { OrganizationSwitcher, useOrganization } from "@clerk/react";
import {
  getInstallUrl,
  linkGitHubInstallation,
  listInstallations,
} from "../api/github";
import {
  getSlackInstallUrl,
  listSlackInstallations,
  linkSlackInstallation,
} from "../api/slack";
import {
  getDiscordInviteUrl,
  getDiscordStatus,
  linkDiscordGuild,
  getDiscordChannels,
  getTriggerChannels,
  setTriggerChannels,
} from "../api/discord";
import { listOrgMembers, assignRole } from "../api/reviewers";
import { SettingsCard } from "../components/SettingsCard";
import { GlobalStatusCard } from "../components/GlobalStatusCard";
import { LogStream } from "../components/LogStream";
import type {
  DiscordChannel,
  DiscordInviteUrl,
  DiscordStatus,
  GitHubInstallation,
  GitHubInstallUrl,
  OrgMember,
  SlackInstallation,
} from "../api/types";

const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "reviewer", label: "Reviewer" },
  { value: "admin", label: "Admin" },
];

export function Settings() {
  const { organization, membership } = useOrganization();
  const isAdmin = membership?.role === "org:admin";

  const [installUrl, setInstallUrl] = useState<GitHubInstallUrl | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [slackInstallUrl, setSlackInstallUrl] = useState<string | null>(null);
  const [slackInstallations, setSlackInstallations] = useState<
    SlackInstallation[]
  >([]);
  const [discordInviteUrl, setDiscordInviteUrl] =
    useState<DiscordInviteUrl | null>(null);
  const [discordStatus, setDiscordStatus] = useState<DiscordStatus | null>(
    null,
  );
  const [guildIdInput, setGuildIdInput] = useState("");
  const [discordLinking, setDiscordLinking] = useState(false);
  const [availableChannels, setAvailableChannels] = useState<DiscordChannel[]>(
    [],
  );
  const [triggerChannelIds, setTriggerChannelIds] = useState<string[]>([]);
  const [triggerSaving, setTriggerSaving] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all([
        getInstallUrl().catch((e) => { console.error("getInstallUrl failed:", e); throw e; }),
        listInstallations().catch((e) => { console.error("listInstallations failed:", e); throw e; }),
        getSlackInstallUrl().catch((e) => { console.error("getSlackInstallUrl failed:", e); throw e; }),
        listSlackInstallations().catch((e) => { console.error("listSlackInstallations failed:", e); throw e; }),
        getDiscordInviteUrl().catch((e) => { console.error("getDiscordInviteUrl failed:", e); throw e; }),
        getDiscordStatus().catch((e) => { console.error("getDiscordStatus failed:", e); throw e; }),
        ...(isAdmin
          ? [listOrgMembers().catch((e) => { console.error("listOrgMembers failed:", e); throw e; })]
          : [Promise.resolve({ members: [] })]),
      ]);
      setInstallUrl(results[0]);
      setInstallations(results[1]);
      setSlackInstallUrl(results[2].install_url);
      setSlackInstallations(results[3]);
      setDiscordInviteUrl(results[4]);
      setDiscordStatus(results[5]);
      if (results[5]?.connected) {
        try {
          const channelsResult = await getDiscordChannels();
          setAvailableChannels(channelsResult.channels);
          const triggerResult = await getTriggerChannels();
          setTriggerChannelIds(triggerResult.channels);
        } catch (e) {
          console.error("Failed to fetch Discord channels:", e);
        }
      }
      if (isAdmin && "members" in results[6]) {
        setMembers((results[6] as { members: OrgMember[] }).members);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installationId = params.get("installation_id");
    if (installationId) {
      linkGitHubInstallation(Number(installationId))
        .then(() => {
          window.history.replaceState({}, "", "/settings");
          fetchData();
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Failed to link GitHub");
        });
    }
  }, [fetchData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const teamId = params.get("team_id");
    if (teamId) {
      linkSlackInstallation(teamId)
        .then(() => {
          window.history.replaceState({}, "", "/settings");
          fetchData();
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Failed to link Slack");
        });
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchData]);

  async function handleRoleChange(userId: string, newRole: string) {
    setRoleLoading(userId);
    setError(null);
    try {
      await assignRole({ user_id: userId, role: newRole });
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === userId
            ? {
                ...m,
                role: newRole,
                role_name:
                  ROLE_OPTIONS.find((r) => r.value === newRole)?.label ??
                  newRole,
              }
            : m,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setRoleLoading(null);
    }
  }

  async function handleDiscordLink() {
    if (!guildIdInput.trim()) return;
    setDiscordLinking(true);
    setError(null);
    try {
      await linkDiscordGuild(guildIdInput.trim());
      setGuildIdInput("");
      fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to link Discord");
    } finally {
      setDiscordLinking(false);
    }
  }

  async function handleToggleChannel(channelId: string) {
    const updated = triggerChannelIds.includes(channelId)
      ? triggerChannelIds.filter((id) => id !== channelId)
      : [...triggerChannelIds, channelId];
    setTriggerChannelIds(updated);
    setTriggerSaving(true);
    setError(null);
    try {
      await setTriggerChannels(updated);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to update trigger channels",
      );
      setTriggerChannelIds(triggerChannelIds);
    } finally {
      setTriggerSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-surface-container-high" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-container" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-surface-container" />
        ))}
      </div>
    );
  }

  if (error && !installUrl) {
    return (
      <div className="space-y-4">
        <h1 className="text-headline-xl font-bold text-on-surface">Settings</h1>
        <div className="bg-error-container/20 border border-error/30 rounded-xl px-4 py-3 text-sm text-error">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-error underline hover:opacity-80"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  fetchData();
                }}
                className="rounded-full bg-error/20 px-3 py-1 text-error hover:bg-error/30"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const connectedCount = [installations.length > 0, slackInstallations.length > 0, discordStatus?.connected === true].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header + Global Status */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-headline-xl text-on-surface mb-2">Integrations</h1>
          <p className="text-on-surface-variant text-body-md max-w-xl">
            Synchronize your ecosystem. Our agents weave through your connected tools to craft
            context-aware documentation in real-time.
          </p>
        </div>
        <GlobalStatusCard sourceCount={connectedCount} />
      </div>

      {/* Error banner (when we have data but there's a non-fatal error) */}
      {error && (
        <div className="bg-error-container/20 border border-error/30 rounded-xl px-4 py-3 text-sm text-error flex items-center justify-between">
          <span>{error}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setError(null)} className="underline hover:opacity-80">
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => { setError(null); fetchData(); }}
              className="rounded-full bg-error/20 px-3 py-1 hover:bg-error/30"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* GitHub */}
        <SettingsCard
          icon={
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          }
          title="GitHub"
          description="Connect Draftly to your GitHub repositories to automatically generate documentation from issues."
          id="GHUB-PR-WATCH"
          connected={installations.length > 0}
          features={[
            { label: "Auto-Ingest", sublabel: "Sync on PR merge", enabled: installations.length > 0 },
            { label: "Codebase Scan", sublabel: "Weekly structure update", enabled: false },
          ]}
          actionLabel={installations.length > 0 ? "Manage Repositories" : "Install GitHub App"}
          onAction={() => {
            if (installUrl?.install_url) {
              window.open(installUrl.install_url, "_blank", "noopener,noreferrer");
            }
          }}
        >
          {installations.length > 0 && (
            <div className="space-y-2">
              {installations.map((inst) => (
                <div key={inst.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-on-surface">{inst.github_org}</span>
                    <span className="text-[10px] font-mono bg-secondary-container/30 text-secondary px-2 py-0.5 rounded-full">
                      Connected
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {Array.isArray(inst.repositories) ? inst.repositories.length : 0}{" "}
                    {Array.isArray(inst.repositories) && inst.repositories.length === 1 ? "repository" : "repositories"}{" "}
                    accessible
                  </p>
                  {Array.isArray(inst.repositories) && inst.repositories.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {inst.repositories.map((repo) => (
                        <span
                          key={repo.full_name}
                          className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant"
                        >
                          {repo.full_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SettingsCard>

        {/* Slack */}
        <SettingsCard
          icon={
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.522h-6.313z" />
            </svg>
          }
          title="Slack"
          description="Connect Draftly to your Slack workspace to automatically generate documentation from support requests."
          id="SLK-882-ING"
          connected={slackInstallations.length > 0}
          features={[
            { label: "Auto-Ingest", sublabel: "Analyze new threads hourly", enabled: slackInstallations.length > 0 },
            { label: "Channel Monitoring", sublabel: "Real-time update pings", enabled: slackInstallations.length > 0 },
          ]}
          actionLabel={slackInstallations.length > 0 ? "Configure Channels" : "Connect Slack Workspace"}
          onAction={() => {
            if (slackInstallUrl) {
              window.open(slackInstallUrl, "_blank", "noopener,noreferrer");
            }
          }}
        >
          {slackInstallations.length > 0 && (
            <div className="space-y-2">
              {slackInstallations.map((inst) => (
                <div key={inst.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-on-surface">{inst.team_name}</span>
                    <span className="text-[10px] font-mono bg-secondary-container/30 text-secondary px-2 py-0.5 rounded-full">
                      Connected
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">Bot ID: {inst.bot_user_id}</p>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>

        {/* Discord */}
        <SettingsCard
          icon={
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
            </svg>
          }
          title="Discord"
          description="Connect Draftly to your Discord server to automatically generate documentation from support requests."
          id="DSC-COMM-1"
          connected={discordStatus?.connected === true}
          features={[
            { label: "Auto-Ingest", sublabel: discordStatus?.connected ? "Active" : "Requires Auth", enabled: discordStatus?.connected === true },
          ]}
          actionLabel={discordStatus?.connected ? "Configure Channels" : "Connect Discord Server"}
          onAction={() => {
            if (discordInviteUrl?.invite_url) {
              window.open(discordInviteUrl.invite_url, "_blank", "noopener,noreferrer");
            }
          }}
        >
          {discordStatus?.connected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-on-surface">Guild: {discordStatus.guild_id}</span>
                <span className="text-[10px] font-mono bg-secondary-container/30 text-secondary px-2 py-0.5 rounded-full">Connected</span>
              </div>

              {/* Trigger Channels (collapsible) */}
              <div>
                <button
                  type="button"
                  onClick={() => setChannelsOpen(!channelsOpen)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-on-surface">Trigger Channels</h4>
                    <p className="text-xs text-on-surface-variant">
                      {triggerSaving && <span className="text-secondary">Saving...</span>}
                      {triggerSaving ? " " : ""}{triggerChannelIds.length} channel{triggerChannelIds.length !== 1 ? "s" : ""} active
                    </p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 ${channelsOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {channelsOpen && (
                  <div className="mt-3 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-outline-variant bg-surface-variant/20 p-2 scrollbar-thin">
                    {availableChannels.length === 0 ? (
                      <p className="text-xs text-on-surface-variant">No channels found</p>
                    ) : (
                      availableChannels.map((ch) => (
                        <label
                          key={ch.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface-variant/40"
                        >
                          <input
                            type="checkbox"
                            checked={triggerChannelIds.includes(ch.id)}
                            onChange={() => handleToggleChannel(ch.id)}
                            disabled={triggerSaving}
                            className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary bg-surface-variant"
                          />
                          <span className="text-on-surface">#{ch.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </SettingsCard>

        {/* Request Integration Placeholder */}
        <div className="border-2 border-dashed border-outline-variant hover:border-primary/50 transition-all duration-300 rounded-xl flex flex-col items-center justify-center p-8 gap-4 cursor-pointer min-h-[300px]">
          <div className="w-16 h-16 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center hover:scale-110 transition-transform">
            <svg className="w-8 h-8 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-on-surface font-bold text-lg">Request Integration</h3>
            <p className="text-on-surface-variant text-sm mt-1">
              Don't see your tool? Suggest a new connection for the Draftly Engine.
            </p>
          </div>
        </div>
      </div>

      {/* Discord Guild ID Input (shown when invite URL is available but not connected yet) */}
      {discordInviteUrl && discordStatus?.connected !== true && (
        <section className="bg-surface-container border border-outline-variant rounded-xl p-6">
          <h2 className="font-bold text-lg text-on-surface">Link Discord Server</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Paste the server ID after adding the Draftly bot to your server.
          </p>
          <div className="mt-4 flex items-end gap-2 max-w-md">
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={guildIdInput}
                onChange={(e) => setGuildIdInput(e.target.value)}
                placeholder="e.g. 123456789012345678"
                className="mt-1 block w-full rounded-xl border border-outline-variant bg-surface-variant/20 px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-on-surface-variant">
                Right-click your server name in Discord → Copy Server ID
              </p>
            </div>
            <button
              type="button"
              onClick={handleDiscordLink}
              disabled={discordLinking || !guildIdInput.trim()}
              className="shrink-0 rounded-full bg-primary text-on-primary px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {discordLinking ? "Connecting..." : "Connect"}
            </button>
          </div>
        </section>
      )}

      {/* Organization */}
      <section className="bg-surface-container border border-outline-variant rounded-xl p-6">
        <h2 className="font-bold text-lg text-on-surface">Organization</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Switch between organizations or manage team settings.
        </p>
        <div className="mt-4">
          <OrganizationSwitcher />
        </div>
        {organization && (
          <div className="mt-4 text-sm text-on-surface-variant">
            <p>
              Active: <strong className="text-on-surface">{organization.name}</strong>
              {membership && (
                <span>
                  {" "}— Role: <strong className="text-on-surface">{membership.role}</strong>
                </span>
              )}
            </p>
          </div>
        )}
      </section>

      {/* Team Roles (admin only) */}
      {isAdmin && (
        <section className="bg-surface-container border border-outline-variant rounded-xl p-6">
          <h2 className="font-bold text-lg text-on-surface">Team Roles</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Assign roles to organization members. Members with the <strong>Reviewer</strong>{" "}
            role can register themselves as reviewers for documentation.
          </p>

          {members.length > 0 ? (
            <div className="mt-4 divide-y divide-outline-variant/30">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-on-surface">{member.email}</p>
                    <p className="text-xs text-on-surface-variant">ID: {member.user_id}</p>
                  </div>
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                    disabled={roleLoading === member.user_id}
                    className="rounded-xl border border-outline-variant bg-surface-variant/30 px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-on-surface-variant">No organization members found.</p>
          )}
        </section>
      )}

      {/* Live Agent Log Stream */}
      <LogStream />
    </div>
  );
}
