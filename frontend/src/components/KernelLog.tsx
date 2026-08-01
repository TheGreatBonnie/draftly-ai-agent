import { useEffect, useRef } from "react";
import { useAgentEvents } from "../hooks/useAgentEvents";
import { eventTypeLabel, formatEventTime, levelTone } from "../utils/events";

export function KernelLog() {
  const { events } = useAgentEvents();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

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
        {events.length === 0 && (
          <p className="text-on-surface-variant/50">[--:--:--] — Waiting for agent activity...</p>
        )}
        {events.map((event, idx) => {
          const tone = levelTone(event.level);
          return (
            <p key={`${event.created_at}-${idx}`} className="flex items-center gap-2">
              <span className="text-on-surface-variant/50 shrink-0">{formatEventTime(event.created_at)}</span>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} />
              <span className={`text-[10px] uppercase font-mono px-1.5 py-px rounded shrink-0 ${tone.badge}`}>
                {event.level}
              </span>
              <span>{eventTypeLabel(event.event_type)}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}
