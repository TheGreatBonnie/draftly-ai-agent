import { useEffect, useState } from "react";
import {
  listReviewers,
  createReviewer,
  deleteReviewer,
} from "../api/reviewers";
import type { Reviewer, CreateReviewerPayload } from "../api/types";

export function Reviewers() {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateReviewerPayload>({
    org_id: "default",
    name: "",
    email: "",
  });

  function load() {
    setLoading(true);
    listReviewers("default")
      .then((res) => setReviewers(res.reviewers))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate() {
    if (!form.name.trim()) return;
    try {
      await createReviewer(form);
      setForm({ org_id: "default", name: "", email: "" });
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

  if (loading && reviewers.length === 0) {
    return <p className="text-gray-500">Loading reviewers...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Reviewers</h1>

      {error && <p className="mb-3 text-red-600">{error}</p>}

      <div className="mb-6 flex gap-2">
        <input
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="Email (optional)"
          value={form.email ?? ""}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <button
          onClick={handleCreate}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add
        </button>
      </div>

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
                {r.email && (
                  <span className="ml-2 text-sm text-gray-500">{r.email}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {r.notify_slack && <span>Slack</span>}
                {r.notify_discord && <span>Discord</span>}
                {r.notify_email && <span>Email</span>}
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
