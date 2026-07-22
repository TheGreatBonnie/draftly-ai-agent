import { request } from "./client";
import type {
  Reviewer,
  CreateReviewerPayload,
  UpdateReviewerPayload,
  OrgMember,
  AssignRolePayload,
} from "./types";

export async function listReviewers(): Promise<{ reviewers: Reviewer[] }> {
  return request("/reviewers");
}

export async function getReviewer(id: string): Promise<Reviewer> {
  return request(`/reviewers/${id}`);
}

export async function createReviewer(payload: CreateReviewerPayload): Promise<Reviewer> {
  return request("/reviewers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateReviewer(
  id: string,
  payload: UpdateReviewerPayload,
): Promise<Reviewer> {
  return request(`/reviewers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteReviewer(id: string): Promise<{ status: string }> {
  return request(`/reviewers/${id}`, { method: "DELETE" });
}

export async function registerSelf(): Promise<Reviewer> {
  return request("/reviewers/self", { method: "POST" });
}

export async function listOrgMembers(): Promise<{ members: OrgMember[] }> {
  return request("/reviewers/org-members");
}

export async function assignRole(payload: AssignRolePayload): Promise<{
  membership_id: string;
  role: string;
  role_name: string;
}> {
  return request("/reviewers/assign-role", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
