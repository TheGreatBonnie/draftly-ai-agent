# Improvement HITL — Notifications + Frontend

## Problem

Improvement proposals from Loop 4 (hill-climbing) are stored in `harness_improvements` with status `pending`, but there is no way for humans to discover or act on them except by calling API endpoints directly.

## Scope

Two independent work streams that can be built in parallel:

### Stream A: Backend (Notifications + Auto-Apply)

1. **Wire `auto_apply_improvements`** in `HillClimber`: if enabled, rubric proposals are auto-applied immediately (no pending); prompt/tool proposals always go through HITL
2. **Notify reviewers** when new proposals are created: reuse the existing `notify_reviewers()` pattern from `human.py` — looks up org reviewers, sends Slack/Discord/Email based on their preferences
3. **Slack improvement card**: `build_improvement_card()` — summarizes proposals (counts by type, highlights), includes approve/reject buttons via HMAC tokens
4. **HMAC improvement tokens**: reuse `generate_review_token()`/`verify_review_token()` from `src/security/tokens.py` (the pattern is identical)
5. **Quick-action endpoints**: `GET /improvements/token/{token}`, `POST /improvements/token/{token}/action`, and `GET /improvements/token/{token}/action` — token-based approve/reject without Clerk auth (same pattern as `/api/review/{token}`). GET variant needed for email link clicks.
6. **Discord interactive blocks**: `build_discord_improvement_card()` — Discord embed with per-proposal View/Approve/Reject buttons. Interaction handled by existing `POST /api/interactions` webhook with new `improvement_*` action prefixes.
7. **Email notifications**: `send_improvement_notification()` — HTML email template with per-proposal HMAC approve/reject links pointing to `GET /improvements/token/{token}/action`.

### Stream B: Frontend (Improvements Page)

6. **API module**: `frontend/src/api/improvements.ts` — `getPendingImprovements(orgId)`, `getImprovement(id)`, `approveImprovement(id)`, `rejectImprovement(id, reason)`, `getActivePrompts(orgId)`, `getActiveRubrics(orgId)`, `getToolConfigs(orgId)`
7. **Types**: `ImprovementProposal`, `PromptVersion`, `RubricVersion`, `ToolConfig`
8. **Page**: `frontend/src/pages/Improvements.tsx` — tabbed view (Pending / History / Config), proposal cards with diff preview (old vs new), approve/reject buttons
9. **Route**: add `/improvements` to protected routes in `App.tsx`
10. **Sidebar**: add "Improvements" link with `auto_awesome` icon

## What Does NOT Change

- `src/analytics/traces.py` — no changes
- `src/analytics/analyzer.py` — no changes
- `src/agents/graph.py` — no changes
- `src/config.py` — no changes (`auto_apply_improvements` already exists)
- Existing API endpoints — no changes
- Database schema — no changes

## Design Decisions

### Auto-apply rules
- `rubric` proposals: auto-apply if `auto_apply_improvements` is `true`
- `prompt` and `tool` proposals: always go through HITL regardless of setting
- Rationale: rubric wording changes are low-risk; prompt/tool changes affect pipeline behavior

### Notifications
- Not sent individually per-proposal; sent as a batch when `run_analysis_cycle()` completes
- Message says e.g. "Draftly found 3 improvements: 1 prompt rewrite, 2 rubric updates"
- Each proposal gets its own HMAC token so reviewers can approve/reject individually from Slack

### Frontend page structure
- Three tabs: **Pending** (proposals with status `pending`), **History** (approved/rejected proposals), **Config** (active prompts/rubrics/tools)
- Pending proposals show a diff-style comparison (current text side-by-side with proposed text)
- Approve/Reject buttons on each proposal card with optional reason textarea for reject

### No Discord blocks
- Starting with Slack notifications only; Discord blocks are significantly more complex and can be added later

## Files Changed

```
New:
  frontend/src/api/improvements.ts
  frontend/src/pages/Improvements.tsx

Modified:
  src/analytics/hill_climber.py           # auto_apply_improvements wiring
  src/analytics/improver.py               # notification trigger after proposals created
  src/integrations/slack_blocks.py        # build_improvement_card()
  src/api/routes/improvements.py          # +2 token-based endpoints
  frontend/src/App.tsx                    # +route
  frontend/src/components/Sidebar.tsx     # +nav link
  frontend/src/api/types.ts              # +types
```

## Test Plan

- `test_hill_climber.py`: extend to verify auto-apply behavior (rubric auto-applied, prompt/tool go to pending)
