import { request } from "./client";
import type { ActivityEvent, AgentEvent, EventLevel, EventSummary } from "./types";

export async function getActivityFeed(limit = 10): Promise<ActivityEvent[]> {
  return request<ActivityEvent[]>(`/activity?limit=${limit}`);
}

export async function getLatestActivity(after: string): Promise<
  Pick<ActivityEvent, "id" | "actor" | "action" | "platform" | "summary" | "created_at">[]
> {
  return request(`/activity/latest?after=${encodeURIComponent(after)}`);
}

export interface AgentEventQuery {
  workflowId?: string;
  level?: EventLevel;
  after?: string;
  limit?: number;
}

export async function getAgentEvents(params?: AgentEventQuery): Promise<AgentEvent[]> {
  const qs = new URLSearchParams();
  if (params?.workflowId) qs.set("workflow_id", params.workflowId);
  if (params?.level) qs.set("level", params.level);
  if (params?.after) qs.set("after", params.after);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  return request<AgentEvent[]>(`/activity/events${suffix}`);
}

export async function getEventSummary(workflowId?: string): Promise<EventSummary> {
  const qs = new URLSearchParams();
  if (workflowId) qs.set("workflow_id", workflowId);
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  return request<EventSummary>(`/activity/events/summary${suffix}`);
}
