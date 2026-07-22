import { useEffect, useState } from "react";
import { useAuth, useOrganization } from "@clerk/react";
import {
  listReviewers,
  createReviewer,
  updateReviewer,
  deleteReviewer,
  registerSelf,
} from "../api/reviewers";
import type {
  Reviewer,
  CreateReviewerPayload,
  UpdateReviewerPayload,
  SelfRegisterPayload,
} from "../api/types";

const emptyAdminForm: CreateReviewerPayload = {
  name: "",
  email: "",
  slack_user_id: "",
  discord_user_id: "",
  notify_slack: true,
  notify_discord: false,
  notify_email: false,
};

const emptySelfForm: SelfRegisterPayload = {
  slack_user_id: "",
  discord_user_id: "",
  notify_slack: true,
  notify_discord: false,
  notify_email: false,
};

const inputClass =
  "rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

export function Reviewers() {
  const { userId } = useAuth();
  const { membership } = useOrganization();
  const role = membership?.role;
  const isReviewerRole = role === "org:reviewer";
  const isAdmin = role === "org:admin";

  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adminForm, setAdminForm] = useState<CreateReviewerPayload>({
    ...emptyAdminForm,
  });
  const [showAdminForm, setShowAdminForm] = useState(false);

  const [selfForm, setSelfForm] = useState<SelfRegisterPayload>({
    ...emptySelfForm,
  });
  const [showSelfForm, setShowSelfForm] = useState(false);
  const [selfRegistering, setSelfRegistering] = useState(false);
  const [editForm, setEditForm] = useState<UpdateReviewerPayload>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const isRegisteredAsReviewer = reviewers.some(
    (r) => r.clerk_user_id === userId,
  );

  function load() {
    setLoading(true);
    listReviewers()
      .then((res) => setReviewers(res.reviewers))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSelfRegister() {
    setSelfRegistering(true);
    setError(null);
    try {
      await registerSelf(selfForm);
      setShowSelfForm(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSelfRegistering(false);
    }
  }

  async function handleCreate() {
    if (!adminForm.name.trim()) return;
    try {
      await createReviewer(adminForm);
      setAdminForm({ ...emptyAdminForm });
      setShowAdminForm(false);
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

  async function handleUpdate() {
    if (!editingId) return;
    try {
      await updateReviewer(editingId, editForm);
      setEditingId(null);
      setEditForm({});
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  function updateEditField<K extends keyof UpdateReviewerPayload>(
    key: K,
    value: UpdateReviewerPayload[K],
  ) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateAdminField<K extends keyof CreateReviewerPayload>(
    key: K,
    value: CreateReviewerPayload[K],
  ) {
    setAdminForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateSelfField<K extends keyof SelfRegisterPayload>(
    key: K,
    value: SelfRegisterPayload[K],
  ) {
    setSelfForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading && reviewers.length === 0) {
    return <p className="text-gray-500">Loading reviewers...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reviewers</h1>
        {isAdmin && (
          <button
            onClick={() => {
              setShowAdminForm(!showAdminForm);
              setShowSelfForm(false);
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showAdminForm ? "Cancel" : "Add Reviewer"}
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-red-600">{error}</p>}

      {isReviewerRole && !isRegisteredAsReviewer && !showSelfForm && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div>
            <p className="font-medium text-blue-900">Register as a reviewer</p>
            <p className="text-sm text-blue-700">
              Add yourself as a reviewer for this organization.
            </p>
          </div>
          <button
            onClick={() => {
              setShowSelfForm(true);
              setShowAdminForm(false);
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Register
          </button>
        </div>
      )}

      {isReviewerRole && !isRegisteredAsReviewer && showSelfForm && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-3 font-semibold text-blue-900">
            Complete Your Registration
          </h2>
          <p className="mb-3 text-sm text-blue-700">
            Set your notification preferences to finish registering.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="Slack User ID"
              value={selfForm.slack_user_id ?? ""}
              onChange={(e) => updateSelfField("slack_user_id", e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Discord User ID"
              value={selfForm.discord_user_id ?? ""}
              onChange={(e) =>
                updateSelfField("discord_user_id", e.target.value)
              }
            />
          </div>

          <div className="mt-3 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-blue-800">
              <input
                type="checkbox"
                checked={selfForm.notify_slack ?? true}
                onChange={(e) =>
                  updateSelfField("notify_slack", e.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Notify via Slack
            </label>
            <label className="flex items-center gap-2 text-sm text-blue-800">
              <input
                type="checkbox"
                checked={selfForm.notify_discord ?? false}
                onChange={(e) =>
                  updateSelfField("notify_discord", e.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Notify via Discord
            </label>
            <label className="flex items-center gap-2 text-sm text-blue-800">
              <input
                type="checkbox"
                checked={selfForm.notify_email ?? false}
                onChange={(e) =>
                  updateSelfField("notify_email", e.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Notify via Email
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowSelfForm(false)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSelfRegister}
              disabled={selfRegistering}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {selfRegistering ? "Registering..." : "Complete Registration"}
            </button>
          </div>
        </div>
      )}

      {showAdminForm && isAdmin && (
        <div className="mb-6 rounded-lg border border-gray-200 p-4">
          <h2 className="mb-3 font-semibold text-gray-900">New Reviewer</h2>

          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="Name *"
              value={adminForm.name}
              onChange={(e) => updateAdminField("name", e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Email"
              value={adminForm.email ?? ""}
              onChange={(e) => updateAdminField("email", e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Slack User ID"
              value={adminForm.slack_user_id ?? ""}
              onChange={(e) => updateAdminField("slack_user_id", e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Discord User ID"
              value={adminForm.discord_user_id ?? ""}
              onChange={(e) =>
                updateAdminField("discord_user_id", e.target.value)
              }
            />
          </div>

          <div className="mt-3 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={adminForm.notify_slack ?? true}
                onChange={(e) =>
                  updateAdminField("notify_slack", e.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Notify via Slack
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={adminForm.notify_discord ?? false}
                onChange={(e) =>
                  updateAdminField("notify_discord", e.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Notify via Discord
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={adminForm.notify_email ?? false}
                onChange={(e) =>
                  updateAdminField("notify_email", e.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Notify via Email
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCreate}
              disabled={!adminForm.name.trim()}
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
                {r.clerk_user_id === userId && (
                  <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                    You
                  </span>
                )}
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
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
