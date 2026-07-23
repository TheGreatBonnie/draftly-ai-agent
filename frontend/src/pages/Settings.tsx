import { useCallback, useEffect, useState } from "react";
import { OrganizationSwitcher, useOrganization } from "@clerk/react";
import {
  getInstallUrl,
  linkGitHubInstallation,
  listInstallations,
} from "../api/github";
import { listSlackInstallations, linkSlackInstallation } from "../api/slack";
import { listOrgMembers, assignRole } from "../api/reviewers";
import type {
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
  const [slackInstallations, setSlackInstallations] = useState<SlackInstallation[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all([
        getInstallUrl(),
        listInstallations(),
        listSlackInstallations(),
        ...(isAdmin ? [listOrgMembers()] : [Promise.resolve({ members: [] })]),
      ]);
      setInstallUrl(results[0]);
      setInstallations(results[1]);
      setSlackInstallations(results[2]);
      if (isAdmin && "members" in results[3]) {
        setMembers((results[3] as { members: OrgMember[] }).members);
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
            ? { ...m, role: newRole, role_name: ROLE_OPTIONS.find((r) => r.value === newRole)?.label ?? newRole }
            : m,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setRoleLoading(null);
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading settings...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Organization section */}
      <section className="rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Organization</h2>
        <p className="mt-1 text-sm text-gray-500">
          Switch between organizations or manage team settings.
        </p>
        <div className="mt-4">
          <OrganizationSwitcher />
        </div>
        {organization && (
          <div className="mt-4 text-sm text-gray-600">
            <p>
              Active: <strong>{organization.name}</strong>
              {membership && (
                <span> — Role: <strong>{membership.role}</strong></span>
              )}
            </p>
          </div>
        )}
      </section>

      {/* Team Roles section (admin only) */}
      {isAdmin && (
        <section className="rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Team Roles</h2>
          <p className="mt-1 text-sm text-gray-500">
            Assign roles to organization members. Members with the <strong>Reviewer</strong> role
            can register themselves as reviewers for documentation.
          </p>

          {members.length > 0 ? (
            <div className="mt-4 divide-y divide-gray-100">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      ID: {member.user_id}
                    </p>
                  </div>
                  <select
                    value={member.role}
                    onChange={(e) =>
                      handleRoleChange(member.user_id, e.target.value)
                    }
                    disabled={roleLoading === member.user_id}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
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
            <p className="mt-4 text-sm text-gray-400">
              No organization members found.
            </p>
          )}
        </section>
      )}

      {/* GitHub Integration section */}
      <section className="rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">GitHub Integration</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect Draftly to your GitHub repositories to automatically generate documentation from issues.
        </p>

        <div className="mt-4">
          {installUrl && (
            <a
              href={installUrl.install_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Install GitHub App
            </a>
          )}
        </div>

        {installations.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700">Connected Organizations</h3>
            <div className="mt-2 space-y-3">
              {installations.map((inst) => (
                <div
                  key={inst.id}
                  className="rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{inst.github_org}</span>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Connected
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {Array.isArray(inst.repositories) ? inst.repositories.length : 0} {Array.isArray(inst.repositories) && inst.repositories.length === 1 ? "repository" : "repositories"} accessible
                  </p>
                  {Array.isArray(inst.repositories) && inst.repositories.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {inst.repositories.map((repo) => (
                        <span
                          key={repo.full_name}
                          className="inline-block rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600"
                        >
                          {repo.full_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {installations.length === 0 && !loading && (
          <p className="mt-4 text-sm text-gray-400">
            No GitHub organizations connected yet. Click the button above to install the Draftly GitHub App.
          </p>
        )}
      </section>

      {/* Slack Integration section */}
      <section className="rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Slack Integration</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect Draftly to your Slack workspace to automatically generate documentation from support requests.
        </p>

        <div className="mt-4">
          <a
            href="/api/slack/install"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.522h-6.313z" />
            </svg>
            Connect Slack Workspace
          </a>
        </div>

        {slackInstallations.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700">Connected Workspaces</h3>
            <div className="mt-2 space-y-3">
              {slackInstallations.map((inst) => (
                <div
                  key={inst.id}
                  className="rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{inst.team_name}</span>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                      Connected
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Bot ID: {inst.bot_user_id}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {slackInstallations.length === 0 && !loading && (
          <p className="mt-4 text-sm text-gray-400">
            No Slack workspaces connected yet. Click the button above to install Draftly.
          </p>
        )}
      </section>
    </div>
  );
}
