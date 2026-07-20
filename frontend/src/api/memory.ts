import { request } from "./client";
import type { MemoryStats, SearchResult } from "./types";

export async function getMemoryStats(): Promise<MemoryStats> {
  return request<MemoryStats>("/memory/stats");
}

export async function searchMemory(
  query: string,
  type: string = "all",
): Promise<SearchResult[]> {
  return request<SearchResult[]>(`/memory/search?q=${encodeURIComponent(query)}&type=${type}`);
}
