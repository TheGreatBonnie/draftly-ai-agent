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
  pending: "bg-primary/15 text-primary",
  approved: "bg-secondary/15 text-secondary",
  rejected: "bg-error/15 text-error",
  needs_changes: "bg-tertiary/15 text-tertiary",
  draft: "bg-surface-variant text-on-surface-variant/70",
  in_review: "bg-primary/10 text-primary/80",
  published: "bg-secondary/10 text-secondary/80",
};

export function Badge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold font-mono ${variants[status] ?? "bg-surface-variant text-on-surface-variant/70"}`}
    >
      {STATUS_LABELS[status] ?? status.replace("_", " ")}
    </span>
  );
}
