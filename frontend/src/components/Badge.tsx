const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  needs_changes: "Needs Changes",
  draft: "Draft",
  in_review: "In Review",
  published: "Published",
};

const variants: Record<string, string> = {
  pending: "badge-pending",
  approved: "badge-approved",
  rejected: "badge-rejected",
  needs_changes: "badge-needs_changes",
  draft: "badge-draft",
  in_review: "badge-in_review",
  published: "badge-published",
};

export function Badge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold font-mono ${variants[status] ?? "badge-draft"}`}
    >
      {STATUS_LABELS[status] ?? status.replace("_", " ")}
    </span>
  );
}
