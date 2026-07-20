const variants: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  needs_changes: "bg-orange-100 text-orange-800",
  draft: "bg-gray-100 text-gray-800",
  in_review: "bg-blue-100 text-blue-800",
  published: "bg-purple-100 text-purple-800",
};

export function Badge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
