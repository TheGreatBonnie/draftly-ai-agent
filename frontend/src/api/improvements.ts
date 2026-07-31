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
