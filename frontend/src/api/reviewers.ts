import { request } from "./client";
import type {
  Reviewer,
  CreateReviewerPayload,
  UpdateReviewerPayload,
} from "./types";

export async function listReviewers(orgId: string): Promise<{ reviewers: Reviewer[] }> {
  return request(`/reviewers?org_id=${orgId}`);
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
