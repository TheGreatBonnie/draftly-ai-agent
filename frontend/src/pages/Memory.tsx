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

const STAT_ICONS: Record<keyof MemoryStats, string> = {
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
        <h1 className="text-[var(--text-heading)] font-bold text-[var(--color-charcoal)]">
          Memory
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-muted)]">
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <span className="material-symbols-outlined text-lg text-[var(--color-muted)]">
                  {STAT_ICONS[key as keyof MemoryStats]}
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--color-charcoal)]">
                  {stats[key as keyof MemoryStats]}
                </div>
                <div className="text-xs text-[var(--color-muted)]">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass-panel rounded-2xl p-6">
        <h2 className="mb-4 text-lg font-bold text-[var(--color-charcoal)]">
          Semantic Search
        </h2>
        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded-full border border-white/60 bg-white/40 px-4 py-2.5 text-sm text-[var(--color-charcoal)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-charcoal)] focus:outline-none"
            placeholder="Search documentation, threads, reviews..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="rounded-full bg-[var(--color-charcoal)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
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
                <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                  <span className="rounded-full bg-[var(--color-sage-light)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--color-sage)]">
                    {r.content_type}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-white/80 bg-white/60 px-2 py-0.5 text-[11px] font-medium">
                    <span className="material-symbols-outlined text-[14px]">
                      psychology
                    </span>
                    {Math.round(r.score * 100)}% match
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-charcoal-light)]">
                  {r.content_text}
                </p>
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !searching && query.trim() && (
          <p className="text-center text-sm text-[var(--color-muted)]">
            No results found.
          </p>
        )}
      </div>
    </div>
  );
}
