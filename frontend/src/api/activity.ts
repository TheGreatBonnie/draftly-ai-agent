import { request } from "./client";
import type { ActivityEvent } from "./types";

export async function getActivityFeed(limit = 10): Promise<ActivityEvent[]> {
  return request<ActivityEvent[]>(`/activity?limit=${limit}`);
}

export async function getLatestActivity(after: string): Promise<
  Pick<ActivityEvent, "id" | "actor" | "action" | "platform" | "summary" | "created_at">[]
> {
  return request(`/activity/latest?after=${encodeURIComponent(after)}`);
}
