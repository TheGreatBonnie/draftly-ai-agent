import { request } from "./client";
import type { Review, ReviewDecision } from "./types";

export async function getPendingReviews(): Promise<Review[]> {
  return request<Review[]>("/reviews/pending");
}

export async function getReview(reviewId: string): Promise<Review> {
  return request<Review>(`/reviews/${reviewId}`);
}

export async function decideReview(
  reviewId: string,
  decision: ReviewDecision,
): Promise<{ status: string; decision: string }> {
  return request(`/reviews/${reviewId}/decide`, {
    method: "POST",
    body: JSON.stringify(decision),
  });
}
