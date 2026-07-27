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
  pending: "bg-[var(--color-sand-light)] text-[var(--color-charcoal)]",
  approved: "bg-[var(--color-sage-light)] text-[var(--color-sage)]",
  rejected: "bg-red-50 text-red-700",
  needs_changes: "bg-[var(--color-terracotta-light)] text-[var(--color-terracotta)]",
  draft: "bg-gray-100 text-gray-600",
  in_review: "bg-blue-50 text-blue-700",
  published: "bg-purple-50 text-purple-700",
};

export function Badge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {STATUS_LABELS[status] ?? status.replace("_", " ")}
    </span>
  );
}
