import type { KnowledgeDoc } from "../api/types";
import { StatsCard } from "./StatsCard";

interface KnowledgeStatsProps {
  docs: KnowledgeDoc[];
}

export function KnowledgeStats({ docs }: KnowledgeStatsProps) {
  const counts = {
    total: docs.length,
    published: docs.filter((d) => d.status === "published").length,
    pending: docs.filter((d) => d.status === "pending").length,
    draft: docs.filter((d) => d.status === "draft").length,
  };

  return (
    <div className="mb-5 grid grid-cols-4 gap-3">
      <StatsCard label="Total Documents" value={counts.total} icon="description" color="var(--color-charcoal)" />
      <StatsCard
        label="Published"
        value={counts.published}
        icon="public"
        color="var(--color-sage)"
      />
      <StatsCard
        label="Pending Review"
        value={counts.pending}
        icon="pending"
        color="var(--color-sand)"
      />
      <StatsCard label="Drafts" value={counts.draft} icon="edit_note" color="var(--color-muted)" />
    </div>
  );
}
