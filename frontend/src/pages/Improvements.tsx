import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/react";
import {
  getPendingImprovements,
  approveImprovement,
  rejectImprovement,
  getActivePrompts,
  getActiveRubrics,
  getToolConfigs,
} from "../api/improvements";
import type { ImprovementProposal, PromptVersion, RubricVersion, ToolConfig } from "../api/types";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "config", label: "Active Config" },
] as const;

type Tab = (typeof TABS)[number]["key"];

function ProposalCard({
  proposal,
  onApprove,
  onReject,
}: {
  proposal: ImprovementProposal;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const changes = proposal.proposed_changes;
  const label =
    (changes.node as string) ||
    (changes.criterion as string) ||
    (changes.name as string) ||
    "Unknown";
  const oldText =
    (changes.current_prompt as string) ||
    (changes.current_text as string) ||
    "";
  const newText =
    (changes.improved_prompt as string) ||
    (changes.improved_text as string) ||
    (changes.description as string) ||
    "";

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">
            {proposal.improvement_type === "prompt"
              ? "edit_note"
              : proposal.improvement_type === "rubric"
                ? "checklist"
                : "build"}
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {proposal.improvement_type}
          </span>
        </div>
        <span className="text-xs text-on-surface-variant/40">
          {new Date(proposal.created_at).toLocaleDateString()}
        </span>
      </div>

      <h3 className="mb-1 font-semibold text-on-surface">{label}</h3>

      {(oldText || newText) && (
        <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl bg-surface-container p-3 text-sm">
          {oldText && (
            <div>
              <p className="mb-1 text-xs font-medium text-on-surface-variant/40">Current</p>
              <pre className="whitespace-pre-wrap text-on-surface">{oldText}</pre>
            </div>
          )}
          {newText && (
            <div>
              <p className="mb-1 text-xs font-medium text-secondary">Proposed</p>
              <pre className="whitespace-pre-wrap text-on-surface">{newText}</pre>
            </div>
          )}
        </div>
      )}

      {proposal.rationale && (
        <p className="mb-4 text-sm text-on-surface-variant">{proposal.rationale}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => onApprove(proposal.id)}
          className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-on-secondary-container hover:opacity-90"
        >
          Approve
        </button>
        <button
          onClick={() => onReject(proposal.id)}
          className="rounded-full bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function ConfigSection({
  title,
  items,
  icon,
}: {
  title: string;
  items: { label: string; text: string; version: number }[];
  icon: string;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">{icon}</span>
        <h2 className="font-semibold text-on-surface">{title}</h2>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="glass-card rounded-xl p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-on-surface">{item.label}</span>
              <span className="text-xs text-on-surface-variant/40">v{item.version}</span>
            </div>
            <p className="line-clamp-3 text-xs text-on-surface-variant">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Improvements() {
  const { organization } = useOrganization();
  const orgId = organization?.id || "";
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<ImprovementProposal[]>([]);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [rubrics, setRubrics] = useState<RubricVersion[]>([]);
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [selected, setSelected] = useState<ImprovementProposal | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    if (!orgId) return;
    setLoading(true);
    Promise.all([
      getPendingImprovements(orgId).then(setPending).catch(() => {}),
      getActivePrompts(orgId).then(setPrompts).catch(() => {}),
      getActiveRubrics(orgId).then(setRubrics).catch(() => {}),
      getToolConfigs(orgId).then(setTools).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [orgId]);

  const handleApprove = async (id: string) => {
    await approveImprovement(id);
    setSelected(null);
    fetchData();
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Reason for rejection (optional):");
    await rejectImprovement(id, reason || "");
    setSelected(null);
    fetchData();
  };

  if (!orgId) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-on-surface-variant">Select an organization to view improvements.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card h-32 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  const configItems = [
    ...prompts.map((p) => ({ label: p.node_name, text: p.prompt_text, version: p.version })),
    ...rubrics.map((r) => ({ label: r.criterion_name, text: r.criterion_text, version: r.version })),
    ...tools.map((t) => ({ label: t.name, text: t.description, version: t.version })),
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-headline-xl font-bold tracking-tight text-on-surface">
          Improvements
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Review and apply AI-suggested improvements to prompts, rubrics, and tools.
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-primary text-on-primary-container"
                : "bg-surface-container-low border border-outline-variant text-on-surface-variant/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "pending" && (
        <div className="space-y-4">
          {selected ? (
            <div>
              <button
                onClick={() => setSelected(null)}
                className="mb-4 text-sm text-primary hover:underline"
              >
                &larr; Back to list
              </button>
              <ProposalCard
                proposal={selected}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </div>
          ) : pending.length === 0 ? (
            <div className="glass-card flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
              <span className="material-symbols-outlined text-3xl text-secondary">
                check_circle
              </span>
              <p className="text-on-surface">No pending improvements.</p>
              <p className="text-sm text-on-surface-variant">
                New suggestions will appear here after trace analysis cycles.
              </p>
            </div>
          ) : (
            pending.map((p) => (
              <div key={p.id} onClick={() => setSelected(p)} className="cursor-pointer">
                <ProposalCard
                  proposal={p}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "config" && (
        <div>
          <ConfigSection title="Prompts" icon="edit_note" items={configItems.slice(0, prompts.length)} />
          <ConfigSection title="Rubrics" icon="checklist" items={configItems.slice(prompts.length, prompts.length + rubrics.length)} />
          {tools.length > 0 && (
            <ConfigSection title="Tools" icon="build" items={configItems.slice(prompts.length + rubrics.length)} />
          )}
        </div>
      )}
    </div>
  );
}
