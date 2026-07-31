import { useEffect, useRef } from "react";
import { getLatestActivity } from "../api/activity";
import type { ActivityEvent } from "../api/types";

interface KernelLogProps {
  initialEntries?: Pick<ActivityEvent, "id" | "actor" | "action" | "platform" | "summary" | "created_at">[];
}

export function KernelLog({ initialEntries = [] }: KernelLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string>("");

  // Track the latest timestamp from initial entries
  useEffect(() => {
    if (initialEntries.length > 0) {
      lastTimestampRef.current = initialEntries[0].created_at;
    }
  }, [initialEntries]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!containerRef.current || !lastTimestampRef.current) return;
      try {
        const newEntries = await getLatestActivity(lastTimestampRef.current);
        if (newEntries.length > 0 && containerRef.current) {
          lastTimestampRef.current = newEntries[0].created_at;
          for (const entry of newEntries.reverse()) {
            const p = document.createElement("p");
            const actorClass =
              entry.actor === "agent" ? "text-primary" :
              entry.actor === "human" ? "text-secondary" :
              "text-on-surface-variant/50";
            p.className = actorClass;
            const time = new Date(entry.created_at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
            p.textContent = `[${time}] — ${entry.summary}`;
            containerRef.current.appendChild(p);
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
          // Cap at 30 entries
          while (containerRef.current.children.length > 30) {
            containerRef.current.removeChild(containerRef.current.firstChild!);
          }
        }
      } catch {
        // silent — polling is best-effort
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl inner-glow-top overflow-hidden relative">
      <div className="scanline opacity-10"></div>
      <div className="px-6 py-4 border-b border-outline-variant/40 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface font-sans">System Kernel Logs</h2>
          <span className="text-[10px] font-mono text-secondary">T: 172.19.0.5</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-on-surface-variant/60">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary pulse-ring inline-block"></span>
          LIVE
        </div>
      </div>
      <div ref={containerRef} className="px-6 py-4 font-mono text-xs leading-relaxed text-on-surface-variant/70 overflow-y-auto relative z-10 max-h-40 scrollbar-thin">
        {initialEntries.length === 0 && (
          <p className="text-on-surface-variant/50">[--:--:--] — Waiting for activity...</p>
        )}
        {initialEntries.slice().reverse().map((entry) => {
          const actorClass =
            entry.actor === "agent" ? "text-primary" :
            entry.actor === "human" ? "text-secondary" :
            "text-on-surface-variant/50";
          return (
            <p key={entry.id} className={actorClass}>
              [{formatTime(entry.created_at)}] — {entry.summary}
            </p>
          );
        })}
      </div>
    </div>
  );
}
