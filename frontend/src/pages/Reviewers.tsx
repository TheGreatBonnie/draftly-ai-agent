import { useEffect, useState } from "react";
import {
  listReviewers,
  createReviewer,
  deleteReviewer,
} from "../api/reviewers";
import type { Reviewer, CreateReviewerPayload } from "../api/types";

const emptyForm: CreateReviewerPayload = {
  name: "",
  email: "",
  slack_user_id: "",
  discord_user_id: "",
  notify_slack: true,
  notify_discord: false,
  notify_email: false,
};

export function Reviewers() {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateReviewerPayload>({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    listReviewers()
      .then((res) => setReviewers(res.reviewers))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate() {
    if (!form.name.trim()) return;
    try {
      await createReviewer(form);
      setForm({ ...emptyForm });
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteReviewer(id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function updateField<K extends keyof CreateReviewerPayload>(
    key: K,
    value: CreateReviewerPayload[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading && reviewers.length === 0) {
    return <p className="text-gray-500">Loading reviewers...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reviewers</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "Add Reviewer"}
        </button>
      </div>

      {error && <p className="mb-3 text-red-600">{error}</p>}

      {showForm && (
        <div className="mb-6 rounded-lg border border-gray-200 p-4">
          <h2 className="mb-3 font-semibold text-gray-900">New Reviewer</h2>

          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Name *"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
            <input
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Email"
              value={form.email ?? ""}
              onChange={(e) => updateField("email", e.target.value)}
            />
            <input
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Slack User ID"
              value={form.slack_user_id ?? ""}
              onChange={(e) => updateField("slack_user_id", e.target.value)}
            />
            <input
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Discord User ID"
              value={form.discord_user_id ?? ""}
              onChange={(e) => updateField("discord_user_id", e.target.value)}
            />
          </div>

          <div className="mt-3 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.notify_slack ?? true}
                onChange={(e) => updateField("notify_slack", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Notify via Slack
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.notify_discord ?? false}
                onChange={(e) => updateField("notify_discord", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Notify via Discord
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.notify_email ?? false}
                onChange={(e) => updateField("notify_email", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Notify via Email
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCreate}
              disabled={!form.name.trim()}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Create Reviewer
            </button>
          </div>
        </div>
      )}

      {reviewers.length === 0 ? (
        <p className="text-gray-500">No reviewers yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reviewers.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
            >
              <div>
                <span className="font-medium">{r.name}</span>
                {r.org_name && (
                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    {r.org_name}
                  </span>
                )}
                {r.email && (
                  <span className="ml-2 text-sm text-gray-500">{r.email}</span>
                )}
                <div className="mt-1 flex gap-2 text-xs text-gray-400">
                  {r.slack_user_id && <span>Slack: {r.slack_user_id}</span>}
                  {r.discord_user_id && (
                    <span>Discord: {r.discord_user_id}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {r.notify_slack && (
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                    Slack
                  </span>
                )}
                {r.notify_discord && (
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">
                    Discord
                  </span>
                )}
                {r.notify_email && (
                  <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-700">
                    Email
                  </span>
                )}
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
