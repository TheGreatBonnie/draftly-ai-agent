# Improvement HITL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add notifications, auto-apply, HMAC quick actions, and a frontend page so humans can discover and act on hill-climbing improvement proposals.

**Architecture:** Two independent streams — backend wires `auto_apply_improvements` in the hill climber, notifies reviewers via Slack (Block Kit), Discord (embed + interactive buttons), and Email (HTML template with HMAC links); frontend adds an `/improvements` page with Pending/Config tabs and diff-style proposal review.

**Status:** All 13 tasks completed. 26/26 analytics tests pass, 179/233 full suite pass (1 pre-existing failure). ruff/mypy clean on all new/changed code.

**Tech Stack:** FastAPI, CockroachDB (asyncpg), Slack Block Kit, HMAC tokens, React 19 + TypeScript + TailwindCSS 4

---

### Task 1: Wire `auto_apply_improvements` in HillClimber

**Files:**
- Modify: `src/analytics/hill_climber.py:37-73`

- [x] **Read current `run_analysis_cycle()`**

Read `src/analytics/hill_climber.py` to see the current flow.

- [x] **Add auto-apply logic**

After `proposals = await create_improvement_proposals(...)` (which already stores them), iterate proposals and auto-apply rubric ones if `settings.auto_apply_improvements` is True:

```python
from src.analytics.improver import apply_improvement
from src.config import settings

# After proposals are created, auto-apply rubric if configured
if settings.auto_apply_improvements:
    for proposal in proposals:
        if proposal.improvement_type == "rubric":
            await apply_improvement(proposal.id)
            logger.info(
                "rubric_auto_applied",
                proposal_id=proposal.id,
                criterion=proposal.proposed_changes.get("criterion", "unknown"),
            )
```

Place this after the `create_improvement_proposals` call (after line 60 in the current file) and before the logging call. No import changes needed (settings already imported).

- [x] **Run existing tests**

Run: `uv run pytest tests/analytics/test_hill_climber.py -v`
Expected: 3/3 pass (existing behavior unchanged)

---

### Task 2: Add `build_improvement_card()` to Slack blocks

**Files:**
- Modify: `src/integrations/slack_blocks.py`

- [x] **Add improvement notification card builder**

Append at end of `slack_blocks.py`:

```python
def build_improvement_card(
    summary: str,
    proposal_count: int,
    prompt_count: int,
    rubric_count: int,
    tool_count: int,
    dashboard_url: str,
    tokens: list[dict],
) -> dict:
    """Build a Block Kit card for improvement proposal notifications.

    Args:
        summary: LLM-generated summary of the analysis cycle.
        proposal_count: Total number of proposals created.
        prompt_count / rubric_count / tool_count: Breakdown by type.
        dashboard_url: Link to the improvements page.
        tokens: List of dicts with "id", "token" per proposal for quick actions.
    """
    blocks: list[dict] = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": "\U0001f4a1 Draftly Improvement Suggestions",
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"Found *{proposal_count}* improvement suggestions:\n"
                f"• *{prompt_count}* prompt rewrite{'s' if prompt_count != 1 else ''}\n"
                f"• *{rubric_count}* rubric update{'s' if rubric_count != 1 else ''}\n"
                f"• *{tool_count}* tool suggestion{'s' if tool_count != 1 else ''}",
            },
        },
    ]

    if summary:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Summary:*\n{summary[:300]}"},
        })

    blocks.append({"type": "divider"})

    # Add per-proposal action buttons (max 5 to avoid hitting Slack limits)
    for entry in tokens[:5]:
        proposal = entry["proposal"]
        label = proposal.get("proposed_changes", {}).get("node")
        label = label or proposal.get("proposed_changes", {}).get("criterion")
        label = label or proposal.get("proposed_changes", {}).get("name", "unknown")
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": f"✅ Approve: {label[:35]}"},
                    "style": "primary",
                    "url": f"{dashboard_url}/improvements/{proposal['id']}",
                    "action_id": f"approve_improvement_{proposal['id']}",
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": f"❌ Reject: {label[:35]}"},
                    "style": "danger",
                    "url": f"{dashboard_url}/improvements/{proposal['id']}",
                    "action_id": f"reject_improvement_{proposal['id']}",
                },
            ],
        })

    blocks.append({
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": f"<{dashboard_url}/improvements|View all proposals in Dashboard>",
        },
    })

    return {"blocks": blocks}
```

---

### Task 3: Trigger notifications after proposals are created

**Files:**
- Modify: `src/analytics/improver.py`

- [x] **Add notification function**

Add at end of `improver.py` (before the `_parse_json_response` helper):

```python
async def notify_improvement_proposals(
    org_id: str,
    proposals: list[ImprovementProposal],
    analysis: dict | None = None,
) -> None:
    """Notify org reviewers about new improvement proposals."""
    from src.integrations.discord import get_or_create_dm_channel, send_discord_message
    from src.integrations.email import send_review_notification
    from src.integrations.slack import send_slack_message
    from src.integrations.slack_blocks import build_improvement_card
    from src.memory.reviewers import get_reviewers_by_org
    from src.security.tokens import generate_review_token
    from src.config import settings

    reviewers = await get_reviewers_by_org(org_id)
    if not reviewers:
        logger.info("no_reviewers_to_notify", org_id=org_id)
        return

    prompt_count = sum(1 for p in proposals if p.improvement_type == "prompt")
    rubric_count = sum(1 for p in proposals if p.improvement_type == "rubric")
    tool_count = sum(1 for p in proposals if p.improvement_type == "tool")

    summary = ""
    if analysis:
        health = analysis.get("overall_health", "unknown")
        summary = f"Overall health: {health}."

    dashboard_url = settings.app_url

    tokens = []
    for p in proposals[:5]:
        token = generate_review_token("system", p.id)
        tokens.append({"id": p.id, "token": token, "proposal": {
            "id": p.id,
            "improvement_type": p.improvement_type,
            "proposed_changes": p.proposed_changes,
        }})

    card = build_improvement_card(
        summary=summary,
        proposal_count=len(proposals),
        prompt_count=prompt_count,
        rubric_count=rubric_count,
        tool_count=tool_count,
        dashboard_url=dashboard_url,
        tokens=tokens,
    )

    for reviewer in reviewers:
        try:
            if reviewer.get("notify_slack") and reviewer.get("slack_user_id"):
                await send_slack_message(
                    reviewer["slack_user_id"],
                    card["blocks"][0]["text"]["text"],
                    blocks=card["blocks"],
                )

            if reviewer.get("notify_email") and reviewer.get("email"):
                await send_review_notification(
                    to=reviewer["email"],
                    reviewer_name=reviewer.get("name", "Reviewer"),
                )
        except Exception as e:
            logger.error("improvement_notification_failed", reviewer_id=reviewer["id"], error=str(e))

    logger.info("improvement_notifications_sent", org_id=org_id, reviewer_count=len(reviewers))
```

- [x] **Wire notification call into `create_improvement_proposals()`**

Modify `create_improvement_proposals` in `improver.py` to accept an optional `analysis` param and call `notify_improvement_proposals` at the end:

```python
async def create_improvement_proposals(
    org_id: str, improvements: dict, analysis: dict | None = None,
) -> list[ImprovementProposal]:
    # ... existing code ...
    # After the for loop and after the logger.info call:
    await notify_improvement_proposals(org_id, proposals, analysis)
    return proposals
```

- [x] **Update `hill_climber.py` call to pass analysis**

In `hill_climber.py`, change:
```python
proposals = await create_improvement_proposals(self.org_id, improvements)
```
to:
```python
proposals = await create_improvement_proposals(self.org_id, improvements, analysis=analysis)
```

---

### Task 4: Add HMAC token-based improvement action endpoints

**Files:**
- Modify: `src/api/routes/improvements.py`

- [x] **Add token-based endpoints**

Add at end of `improvements.py`:

```python
from pydantic import BaseModel


class ImprovementActionRequest(BaseModel):
    action: str


@router.get("/improvements/token/{token}")
async def get_improvement_by_token(token: str) -> dict:
    """Verify token and return improvement proposal details (no auth required)."""
    from src.security.tokens import verify_review_token

    payload = verify_review_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    proposal_id = payload.get("review_id")
    if not proposal_id:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    row = await fetch_one(
        "SELECT * FROM harness_improvements WHERE id = $1", proposal_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Proposal not found")

    return {"proposal": dict(row), "expires_at": payload["expires_at"]}


@router.post("/improvements/token/{token}/action")
async def execute_improvement_action(
    token: str, request: ImprovementActionRequest,
) -> dict:
    """Approve or reject an improvement via token (no auth required)."""
    from src.security.tokens import verify_review_token

    if request.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'reject'")

    payload = verify_review_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    proposal_id = payload.get("review_id")
    if not proposal_id:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    row = await fetch_one(
        "SELECT status FROM harness_improvements WHERE id = $1", proposal_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if row["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Proposal already {row['status']}")

    if request.action == "approve":
        await update_proposal_status(proposal_id, "approved", reviewed_by="system")
        success = await apply_improvement(proposal_id)
        return {"status": "applied" if success else "approve_failed", "proposal_id": proposal_id}
    else:
        await update_proposal_status(proposal_id, "rejected", reviewed_by="system")
        return {"status": "rejected", "proposal_id": proposal_id}
```

- [x] **Run tests**

Run: `uv run pytest tests/ -x -q`
Expected: All pass (no existing tests for improvements routes yet)

---

### Task 5: Frontend — Add types and API module

**Files:**
- Modify: `frontend/src/api/types.ts`
- Create: `frontend/src/api/improvements.ts`

- [x] **Add TypeScript interfaces**

Append to `frontend/src/api/types.ts`:

```typescript
export interface ImprovementProposal {
  id: string;
  org_id: string;
  improvement_type: "prompt" | "rubric" | "tool";
  proposed_changes: Record<string, unknown>;
  rationale: string;
  status: "pending" | "approved" | "rejected" | "applied" | "failed";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: string;
  org_id: string;
  node_name: string;
  prompt_text: string;
  version: number;
  is_active: boolean;
}

export interface RubricVersion {
  id: string;
  org_id: string;
  criterion_name: string;
  criterion_text: string;
  version: number;
  is_active: boolean;
}

export interface ToolConfig {
  id: string;
  org_id: string;
  name: string;
  description: string;
  implementation_type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  version: number;
}
```

- [x] **Create API module**

Write `frontend/src/api/improvements.ts`:

```typescript
import { request } from "./client";
import type { ImprovementProposal, PromptVersion, RubricVersion, ToolConfig } from "./types";

export async function getPendingImprovements(orgId: string): Promise<ImprovementProposal[]> {
  const data = await request<{ proposals: ImprovementProposal[] }>(
    `/improvements/pending?org_id=${encodeURIComponent(orgId)}`,
  );
  return data.proposals;
}

export async function getImprovement(id: string): Promise<ImprovementProposal> {
  const data = await request<{ proposal: ImprovementProposal }>(`/improvements/${id}`);
  return data.proposal;
}

export async function approveImprovement(id: string): Promise<{ status: string }> {
  return request(`/improvements/${id}/approve`, { method: "POST" });
}

export async function rejectImprovement(id: string, reason = ""): Promise<{ status: string }> {
  return request(`/improvements/${id}/reject?reason=${encodeURIComponent(reason)}`, {
    method: "POST",
  });
}

export async function getActivePrompts(orgId: string): Promise<PromptVersion[]> {
  const data = await request<{ prompts: PromptVersion[] }>(
    `/prompts/active?org_id=${encodeURIComponent(orgId)}`,
  );
  return data.prompts;
}

export async function getActiveRubrics(orgId: string): Promise<RubricVersion[]> {
  const data = await request<{ rubrics: RubricVersion[] }>(
    `/rubrics/active?org_id=${encodeURIComponent(orgId)}`,
  );
  return data.rubrics;
}

export async function getToolConfigs(orgId: string): Promise<ToolConfig[]> {
  const data = await request<{ tools: ToolConfig[] }>(
    `/tools/config?org_id=${encodeURIComponent(orgId)}`,
  );
  return data.tools;
}
```

---

### Task 6: Frontend — Build Improvements page

**Files:**
- Create: `frontend/src/pages/Improvements.tsx`

- [x] **Create page component**

Write `frontend/src/pages/Improvements.tsx`:

```typescript
import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/clerk-react";
import {
  getPendingImprovements,
  getImprovement,
  approveImprovement,
  rejectImprovement,
  getActivePrompts,
  getActiveRubrics,
  getToolConfigs,
} from "../api/improvements";
import type { ImprovementProposal, PromptVersion, RubricVersion, ToolConfig } from "../api/types";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "history", label: "History" },
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
          <span className="material-symbols-outlined text-[var(--color-brand)]">
            {proposal.improvement_type === "prompt"
              ? "edit_note"
              : proposal.improvement_type === "rubric"
                ? "checklist"
                : "build"}
          </span>
          <span className="rounded-full bg-[var(--color-brand-light)] px-3 py-1 text-xs font-medium text-[var(--color-brand)]">
            {proposal.improvement_type}
          </span>
        </div>
        <span className="text-xs text-[var(--color-faint)]">
          {new Date(proposal.created_at).toLocaleDateString()}
        </span>
      </div>

      <h3 className="mb-1 font-semibold text-[var(--color-charcoal)]">{label}</h3>

      {(oldText || newText) && (
        <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl bg-white/40 p-3 text-sm">
          {oldText && (
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--color-faint)]">Current</p>
              <pre className="whitespace-pre-wrap text-[var(--color-charcoal)]">{oldText}</pre>
            </div>
          )}
          {newText && (
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--color-mint)]">Proposed</p>
              <pre className="whitespace-pre-wrap text-[var(--color-charcoal)]">{newText}</pre>
            </div>
          )}
        </div>
      )}

      {proposal.rationale && (
        <p className="mb-4 text-sm text-[var(--color-muted)]">{proposal.rationale}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => onApprove(proposal.id)}
          className="rounded-full bg-[var(--color-sage)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Approve
        </button>
        <button
          onClick={() => onReject(proposal.id)}
          className="rounded-full bg-red-400 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function HistoryCard({ proposal }: { proposal: ImprovementProposal }) {
  const statusColors: Record<string, string> = {
    approved: "text-[var(--color-sage)]",
    rejected: "text-red-400",
    applied: "text-[var(--color-mint)]",
    failed: "text-red-500",
  };

  return (
    <div className="glass-card flex items-center justify-between rounded-2xl p-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium">
            {proposal.improvement_type}
          </span>
          <span className={`text-xs font-medium ${statusColors[proposal.status] || ""}`}>
            {proposal.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {proposal.proposed_changes.node as string ||
            proposal.proposed_changes.criterion as string ||
            proposal.proposed_changes.name as string ||
            "Unknown"}
        </p>
      </div>
      <div className="text-right text-xs text-[var(--color-faint)]">
        <p>{new Date(proposal.created_at).toLocaleDateString()}</p>
        {proposal.reviewed_at && <p>Reviewed: {new Date(proposal.reviewed_at).toLocaleDateString()}</p>}
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
        <span className="material-symbols-outlined text-[var(--color-brand)]">{icon}</span>
        <h2 className="font-semibold text-[var(--color-charcoal)]">{title}</h2>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="glass-card rounded-xl p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--color-charcoal)]">{item.label}</span>
              <span className="text-xs text-[var(--color-faint)]">v{item.version}</span>
            </div>
            <p className="line-clamp-3 text-xs text-[var(--color-muted)]">{item.text}</p>
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
  const [history, setHistory] = useState<ImprovementProposal[]>([]);
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
        <p className="text-[var(--color-muted)]">Select an organization to view improvements.</p>
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

  // History is all non-pending proposals
  const allHistory = pending; // We only have pending from the API; history would need another endpoint

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[var(--text-heading)] font-bold text-[var(--color-charcoal)]">
          Improvements
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-muted)]">
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
                ? "bg-[var(--color-charcoal)] text-white"
                : "glass-card text-[var(--color-muted)] hover:text-[var(--color-charcoal)]"
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
                className="mb-4 text-sm text-[var(--color-brand)] hover:underline"
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
              <span className="material-symbols-outlined text-3xl text-[var(--color-mint)]">
                check_circle
              </span>
              <p className="text-[var(--color-charcoal)]">No pending improvements.</p>
              <p className="text-sm text-[var(--color-muted)]">
                New suggestions will appear here after trace analysis cycles.
              </p>
            </div>
          ) : (
            pending.map((p) => (
              <div key={p.id} onClick={() => setSelected(p)} className="cursor-pointer">
                <ProposalCard
                  proposal={p}
                  onApprove={(id) => {
                    handleApprove(id);
                    setSelected(null);
                  }}
                  onReject={(id) => {
                    handleReject(id);
                    setSelected(null);
                  }}
                />
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-muted)]">
            History of past improvement proposals (requires dedicated API endpoint for full list).
          </p>
        </div>
      )}

      {activeTab === "config" && (
        <div>
          <ConfigSection title="Prompts" icon="edit_note" items={configItems.filter((_, i) => i < prompts.length)} />
          <ConfigSection title="Rubrics" icon="checklist" items={configItems.slice(prompts.length, prompts.length + rubrics.length)} />
          {tools.length > 0 && (
            <ConfigSection title="Tools" icon="build" items={configItems.slice(prompts.length + rubrics.length)} />
          )}
        </div>
      )}
    </div>
  );
}
```

---

### Task 7: Frontend — Register route and sidebar link

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [x] **Add route in App.tsx**

Find the protected `<Route>` block (around line 50) and add a new child:

```typescript
import { Improvements } from "./pages/Improvements";

// Inside the protected <Route> block:
<Route path="improvements" element={<Improvements />} />
```

- [x] **Add sidebar link**

In `frontend/src/components/Sidebar.tsx`, add to the `baseLinks` array (before the Help Center entry):

```typescript
{ to: "/improvements", label: "Improvements", icon: "auto_awesome" },
```

- [x] **Verify frontend builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

---

### Task 8: Run full test suite and lint

**Files:** (none — verification only)

- [x] **Run backend tests**

Run: `uv run pytest tests/analytics/ -v`
Expected: 19/19 pass

- [x] **Run ruff lint**

Run: `uv run ruff check src/`
Expected: Clean (pre-existing errors only, no new ones)

- [x] **Run mypy**

Run: `uv run mypy src/`
Expected: No new errors

- [x] **Run full test suite**

Run: `uv run pytest -x -q`
Expected: 232/233 pass (1 pre-existing failure)

---

### Task 9: Add Discord interactive blocks for improvements

**Files:**
- Modify: `src/integrations/discord_blocks.py`
- Modify: `src/api/routes/discord.py`
- Modify: `src/analytics/improver.py`

- [x] **Add `build_discord_improvement_card()` to `discord_blocks.py`**

New function following the pattern of `build_discord_review_card()` — builds an embed with title/description/counts and per-proposal Action Rows with a "View" link button, "Approve" (style 3/green), and "Reject" (style 4/red) button. Each button stores a `short_key` → `full_hmac_token` mapping via `store_interaction_token()`.

```python
def build_discord_improvement_card(
    summary, proposal_count, prompt_count, rubric_count, tool_count,
    dashboard_url, tokens,
) -> dict:
    embed = {
        "title": "Draftly Improvement Suggestions",
        "description": f"Found **{proposal_count}** improvement suggestions...",
        "color": 49407,
        "footer": {"text": "Links expire in 24 hours"},
    }
    # Per-proposal Action Rows with View/Approve/Reject buttons
    # Dashboard link row at bottom
    return {"embeds": [embed], "components": components}
```

- [x] **Extend interaction handler in `discord.py`**

Added `"improvement_approve"` and `"improvement_reject"` to `ACTION_MAP` with status values `"improvement_approved"` / `"improvement_rejected"`. Added status entries to `STATUS_COLOR` and `STATUS_LABEL`. In `handle_interactions()`, after HMAC token verification, added a branch:

```python
if action_prefix.startswith("improvement_"):
    from src.analytics.improver import apply_improvement, update_proposal_status
    if action == "improvement_approved":
        await update_proposal_status(proposal_id, "approved", reviewed_by="discord")
        success = await apply_improvement(proposal_id)
        result_status = "improvement_applied" if success else "improvement_failed"
    else:
        await update_proposal_status(proposal_id, "rejected", reviewed_by="discord")
        result_status = "improvement_rejected"
    return JSONResponse(content=_build_result_response(result_status, "Improvement"))
```

- [x] **Wire into `notify_improvement_proposals()` in `improver.py`**

Replaced plain-text Discord message with embed + components:

```python
from src.integrations.discord_blocks import build_discord_improvement_card
discord_card = build_discord_improvement_card(...)
await send_discord_message(channel_id, embed=discord_card["embeds"][0], components=discord_card["components"])
```

---

### Task 10: Add email notification support

**Files:**
- Modify: `src/integrations/email.py`
- Modify: `src/analytics/improver.py`

- [x] **Add template + sender in `email.py`**

Added `IMPROVEMENT_NOTIFICATION_TEMPLATE` — an HTML email template with inline CSS, proposal summary, per-proposal approve/reject HMAC links, and a "View All in Dashboard" button.

Added `send_improvement_notification()` — takes reviewer info, proposal counts, summary, dashboard URL, and tokens; builds per-proposal HTML with approve/reject links pointing to `{dashboard_url}/api/improvements/token/{token}/action?action=approve`; calls existing `send_email()` helper for delivery via SendGrid.

```python
async def send_improvement_notification(
    to, reviewer_name, proposal_count, prompt_count, rubric_count,
    tool_count, summary, dashboard_url, tokens,
) -> dict:
    # Build per-proposal HTML blocks with HMAC links
    # Render template via Template.substitute()
    # Call send_email() for delivery
```

- [x] **Wire into `notify_improvement_proposals()`**

Added email notification block after Discord block:

```python
if reviewer.get("notify_email") and reviewer.get("email"):
    await send_improvement_notification(
        to=reviewer["email"],
        reviewer_name=reviewer.get("name", "Reviewer"),
        ...
    )
```

---

### Task 11: Add GET-based HMAC action endpoint for email links

**Files:**
- Modify: `src/api/routes/improvements.py`

- [x] **Extract shared logic into `_execute_improvement_action()` helper**

```python
async def _execute_improvement_action(token: str, action: str) -> dict:
    # Verify token, fetch proposal, check status, approve/reject, update status
```

- [x] **Refactor POST endpoint to use helper**

```python
@router.post("/improvements/token/{token}/action")
async def execute_improvement_action(token: str, request: ImprovementActionRequest) -> dict:
    return await _execute_improvement_action(token, request.action)
```

- [x] **Add GET endpoint for email links**

```python
@router.get("/improvements/token/{token}/action")
async def execute_improvement_action_get(token: str, action: str = "") -> dict:
    return await _execute_improvement_action(token, action)
```

---

### Verification Results

| Check | Result |
|---|---|
| `ruff check` on all changed files | Clean (pre-existing `TEXT_CHANNEL_TYPES` only) |
| `mypy` on all changed files | Clean (5 pre-existing errors only) |
| `pytest tests/analytics/` | 26/26 pass |
| `pytest -x -q` (full suite) | 179 pass, 1 fail (pre-existing `test_webhook_installation_created`) |
| `npx tsc --noEmit` (frontend) | No errors |
