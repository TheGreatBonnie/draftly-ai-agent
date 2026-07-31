import { useEffect, useState } from "react";
import { getMemoryStats, searchMemory } from "../api/memory";
import type { MemoryStats, SearchResult } from "../api/types";

type MemoryStatCounts = Pick<MemoryStats, "support_threads" | "documentation" | "embeddings" | "review_sessions" | "agent_memory" | "audit_logs">;

const statLabels: Record<keyof MemoryStatCounts, string> = {
  support_threads: "Support Threads",
  documentation: "Documentation",
  embeddings: "Embeddings",
  review_sessions: "Review Sessions",
  agent_memory: "Agent Memory",
  audit_logs: "Audit Logs",
};

const STAT_ICONS: Record<keyof MemoryStatCounts, string> = {
  support_threads: "forum",
  documentation: "description",
  embeddings: "vector_square",
  review_sessions: "rate_review",
  agent_memory: "psychology",
  audit_logs: "history",
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
      <div className="mb-8">
        <h1 className="text-headline-xl font-bold text-on-surface">
          Memory
        </h1>
        <p className="mt-0.5 text-sm text-on-surface-variant">
          Semantic search across all your documentation and threads.
        </p>
      </div>

      {stats && (
        <div className="mb-8 grid grid-cols-3 gap-4">
          {Object.entries(statLabels).map(([key, label]) => (
            <div
              key={key}
              className="glass-card flex items-center gap-3 rounded-2xl p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low border border-outline-variant">
                <span className="material-symbols-outlined text-lg text-on-surface-variant">
                  {STAT_ICONS[key as keyof MemoryStatCounts]}
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold text-on-surface">
                  {(stats as MemoryStatCounts)[key as keyof MemoryStatCounts]}
                </div>
                <div className="text-xs text-on-surface-variant">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass-panel rounded-2xl p-6">
        <h2 className="mb-4 text-lg font-bold text-on-surface">
          Semantic Search
        </h2>
        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded-full border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
            placeholder="Search documentation, threads, reviews..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary-container hover:opacity-90 disabled:opacity-50"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((r, i) => (
              <div
                key={`${r.content_id}-${i}`}
                className="glass-card rounded-xl p-4"
              >
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span className="rounded-full bg-secondary/10 px-2.5 py-0.5 text-[10px] font-medium text-secondary">
                    {r.content_type}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-outline-variant/80 bg-surface-container-high px-2 py-0.5 text-[11px] font-medium">
                    <span className="material-symbols-outlined text-[14px]">
                      psychology
                    </span>
                    {Math.round(r.score * 100)}% match
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                  {r.content_text}
                </p>
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !searching && query.trim() && (
          <p className="text-center text-sm text-on-surface-variant">
            No results found.
          </p>
        )}
      </div>
    </div>
  );
}
