import { request } from "./client";
import type { KnowledgeDoc, IngestKnowledgePayload, FetchUrlResponse } from "./types";

export async function listKnowledge(): Promise<KnowledgeDoc[]> {
  return request<KnowledgeDoc[]>("/knowledge");
}

export async function ingestKnowledge(
  payload: IngestKnowledgePayload,
): Promise<{ id: string; title: string; status: string }> {
  return request("/knowledge", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteKnowledge(
  docId: string,
): Promise<{ status: string }> {
  return request(`/knowledge/${docId}`, { method: "DELETE" });
}

export async function fetchUrlContent(url: string): Promise<FetchUrlResponse> {
  return request("/knowledge/fetch-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}
