import { request } from "./client";
import type { KnowledgeDoc, IngestKnowledgePayload } from "./types";

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
