import { request } from "./client";
import type { Doc } from "./types";

export async function listDocs(): Promise<Doc[]> {
  return request<Doc[]>("/docs/");
}

export async function getDoc(docId: string): Promise<Doc> {
  return request<Doc>(`/docs/${docId}`);
}
