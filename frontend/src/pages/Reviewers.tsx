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
  "w-full rounded-lg border border-white/60 bg-white/40 px-3.5 py-2 text-sm text-[var(--color-charcoal)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-charcoal)] focus:outline-none";

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
  const [updating, setUpdating] = useState(false);

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
    if (!editingId || updating) return;
    setUpdating(true);
    try {
      await updateReviewer(editingId, editForm);
      setEditingId(null);
      setEditForm({});
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(false);
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
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="glass-card h-20 animate-pulse rounded-2xl"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-heading)] font-bold text-[var(--color-charcoal)]">
            Reviewers
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">
            Manage who can approve and review documentation.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setShowAdminForm(!showAdminForm);
              setShowSelfForm(false);
            }}
            className="rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-[var(--color-brand-hover)] hover:shadow-lg active:scale-95"
          >
            {showAdminForm ? "Cancel" : "+ Add Reviewer"}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 font-medium text-red-700 hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {isReviewerRole && !isRegisteredAsReviewer && !showSelfForm && (
        <div className="glass-panel mb-6 flex items-center justify-between rounded-2xl p-5">
          <div>
            <p className="font-semibold text-[var(--color-charcoal)]">
              Register as a reviewer
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              Add yourself as a reviewer for this organization.
            </p>
          </div>
          <button
            onClick={() => {
              setShowSelfForm(true);
              setShowAdminForm(false);
            }}
            className="rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-[var(--color-brand-hover)] active:scale-95"
          >
            Register
          </button>
        </div>
      )}

      {isReviewerRole && !isRegisteredAsReviewer && showSelfForm && (
        <div className="glass-panel mb-6 rounded-2xl p-6">
          <h2 className="mb-3 text-lg font-bold text-[var(--color-charcoal)]">
            Complete Your Registration
          </h2>
          <p className="mb-4 text-sm text-[var(--color-muted)]">
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
            <label className="flex items-center gap-2 text-sm text-[var(--color-charcoal)]">
              <input
                type="checkbox"
                checked={selfForm.notify_slack ?? true}
                onChange={(e) =>
                  updateSelfField("notify_slack", e.target.checked)
                }
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              Notify via Slack
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-charcoal)]">
              <input
                type="checkbox"
                checked={selfForm.notify_discord ?? false}
                onChange={(e) =>
                  updateSelfField("notify_discord", e.target.checked)
                }
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              Notify via Discord
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-charcoal)]">
              <input
                type="checkbox"
                checked={selfForm.notify_email ?? false}
                onChange={(e) =>
                  updateSelfField("notify_email", e.target.checked)
                }
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              Notify via Email
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowSelfForm(false)}
              className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSelfRegister}
              disabled={selfRegistering}
              className="rounded-full bg-[var(--color-sage)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {selfRegistering ? "Registering..." : "Complete Registration"}
            </button>
          </div>
        </div>
      )}

      {showAdminForm && isAdmin && (
        <div className="glass-panel mb-6 rounded-2xl p-6">
          <h2 className="mb-3 text-lg font-bold text-[var(--color-charcoal)]">
            New Reviewer
          </h2>

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
            <label className="flex items-center gap-2 text-sm text-[var(--color-charcoal)]">
              <input
                type="checkbox"
                checked={adminForm.notify_slack ?? true}
                onChange={(e) =>
                  updateAdminField("notify_slack", e.target.checked)
                }
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              Notify via Slack
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-charcoal)]">
              <input
                type="checkbox"
                checked={adminForm.notify_discord ?? false}
                onChange={(e) =>
                  updateAdminField("notify_discord", e.target.checked)
                }
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              Notify via Discord
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-charcoal)]">
              <input
                type="checkbox"
                checked={adminForm.notify_email ?? false}
                onChange={(e) =>
                  updateAdminField("notify_email", e.target.checked)
                }
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              Notify via Email
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCreate}
              disabled={!adminForm.name.trim()}
              className="rounded-full bg-[var(--color-sage)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Create Reviewer
            </button>
          </div>
        </div>
      )}

      {editingId && (
        <div className="glass-panel mb-6 rounded-2xl p-6">
          <h2 className="mb-3 text-lg font-bold text-[var(--color-charcoal)]">
            Edit Reviewer
          </h2>

          {isAdmin && (
            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder="Name *"
                value={editForm.name ?? ""}
                onChange={(e) => updateEditField("name", e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Email"
                value={editForm.email ?? ""}
                onChange={(e) => updateEditField("email", e.target.value)}
              />
            </div>
          )}

          {isReviewerRole && !isAdmin && (
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                  Name
                </label>
                <input
                  className={`${inputClass} bg-gray-100`}
                  value={
                    reviewers.find((r) => r.id === editingId)?.name ?? ""
                  }
                  disabled
                  readOnly
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                  Email
                </label>
                <input
                  className={`${inputClass} bg-gray-100`}
                  value={
                    reviewers.find((r) => r.id === editingId)?.email ?? ""
                  }
                  disabled
                  readOnly
                />
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="Slack User ID"
              value={editForm.slack_user_id ?? ""}
              onChange={(e) => updateEditField("slack_user_id", e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Discord User ID"
              value={editForm.discord_user_id ?? ""}
              onChange={(e) => updateEditField("discord_user_id", e.target.value)}
            />
          </div>

          <div className="mt-3 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--color-charcoal)]">
              <input
                type="checkbox"
                checked={editForm.notify_slack ?? true}
                onChange={(e) => updateEditField("notify_slack", e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              Notify via Slack
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-charcoal)]">
              <input
                type="checkbox"
                checked={editForm.notify_discord ?? false}
                onChange={(e) => updateEditField("notify_discord", e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              Notify via Discord
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-charcoal)]">
              <input
                type="checkbox"
                checked={editForm.notify_email ?? false}
                onChange={(e) => updateEditField("notify_email", e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              Notify via Email
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                setEditingId(null);
                setEditForm({});
              }}
              className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={updating || (isAdmin && !editForm.name?.trim())}
              className="rounded-full bg-[var(--color-sage)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {updating ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {reviewers.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <span className="material-symbols-outlined mb-3 text-4xl text-[var(--color-faint)]">
            rate_review
          </span>
          <p className="text-sm text-[var(--color-muted)]">No reviewers yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reviewers.map((r) => (
            <div
              key={r.id}
              className="glass-card flex items-center justify-between rounded-2xl p-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  <span className="material-symbols-outlined text-lg text-[var(--color-muted)]">
                    person
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--color-charcoal)]">
                      {r.name}
                    </span>
                    {r.clerk_user_id === userId && (
                      <span className="rounded-full bg-[var(--color-brand-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-brand)]">
                        You
                      </span>
                    )}
                  </div>
                  {r.email && (
                    <p className="text-sm text-[var(--color-muted)]">
                      {r.email}
                    </p>
                  )}
                  <div className="mt-1 flex gap-2 text-xs text-[var(--color-faint)]">
                    {r.slack_user_id && <span>Slack: {r.slack_user_id}</span>}
                    {r.discord_user_id && (
                      <span>Discord: {r.discord_user_id}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.notify_slack && (
                  <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-medium text-purple-700">
                    Slack
                  </span>
                )}
                {r.notify_discord && (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-medium text-indigo-700">
                    Discord
                  </span>
                )}
                {r.notify_email && (
                  <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-medium text-green-700">
                    Email
                  </span>
                )}
                {isAdmin && (
                  <button
                    onClick={() => {
                      setShowAdminForm(false);
                      setShowSelfForm(false);
                      setEditingId(r.id);
                      setEditForm({
                        name: r.name,
                        email: r.email ?? "",
                        slack_user_id: r.slack_user_id ?? "",
                        discord_user_id: r.discord_user_id ?? "",
                        notify_slack: r.notify_slack,
                        notify_discord: r.notify_discord,
                        notify_email: r.notify_email,
                      });
                    }}
                    className="text-sm font-medium text-[var(--color-brand)] hover:underline"
                  >
                    Edit
                  </button>
                )}
                {isReviewerRole && r.clerk_user_id === userId && (
                  <button
                    onClick={() => {
                      setShowSelfForm(false);
                      setEditingId(r.id);
                      setEditForm({
                        slack_user_id: r.slack_user_id ?? "",
                        discord_user_id: r.discord_user_id ?? "",
                        notify_slack: r.notify_slack,
                        notify_discord: r.notify_discord,
                        notify_email: r.notify_email,
                      });
                    }}
                    className="text-sm font-medium text-[var(--color-brand)] hover:underline"
                  >
                    Edit Profile
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-sm font-medium text-red-500 hover:underline"
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
