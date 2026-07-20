import { useEffect, useState } from "react";
import { getMemoryStats, searchMemory } from "../api/memory";
import type { MemoryStats, SearchResult } from "../api/types";

const statLabels: Record<keyof MemoryStats, string> = {
  support_threads: "Support Threads",
  documentation: "Documentation",
  embeddings: "Embeddings",
  review_sessions: "Review Sessions",
  agent_memory: "Agent Memory",
  audit_logs: "Audit Logs",
};

export function Memory() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    getMemoryStats().then(setStats);
  }, []);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await searchMemory(query);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Memory</h1>

      {stats && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {Object.entries(statLabels).map(([key, label]) => (
            <div
              key={key}
              className="rounded-lg border border-gray-200 p-3 text-center"
            >
              <div className="text-2xl font-bold text-gray-900">
                {stats[key as keyof MemoryStats]}
              </div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-lg font-semibold">Semantic Search</h2>
      <div className="mb-4 flex gap-2">
        <input
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="Search documentation, threads, reviews..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((r, i) => (
            <div
              key={`${r.content_id}-${i}`}
              className="rounded-lg border border-gray-200 p-3"
            >
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-medium">{r.content_type}</span>
                <span>·</span>
                <span>Score: {Math.round(r.score * 100)}%</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{r.content_text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
