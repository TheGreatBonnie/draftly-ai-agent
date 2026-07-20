import { useEffect, useState } from "react";
import { getInstallUrl, listInstallations } from "../api/github";
import type { GitHubInstallation, GitHubInstallUrl } from "../api/types";

export function Settings() {
  const [installUrl, setInstallUrl] = useState<GitHubInstallUrl | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [urlResult, installs] = await Promise.all([
        getInstallUrl(),
        listInstallations(),
      ]);
      setInstallUrl(urlResult);
      setInstallations(installs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Re-fetch when page gains focus (e.g., returning from GitHub install)
  useEffect(() => {
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (loading) {
    return <p className="text-gray-500">Loading settings...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

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
                    {inst.repositories.length} {inst.repositories.length === 1 ? "repository" : "repositories"} accessible
                  </p>
                  {inst.repositories.length > 0 && (
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
    </div>
  );
}
