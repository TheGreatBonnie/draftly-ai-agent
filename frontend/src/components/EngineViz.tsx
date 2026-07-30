import { IntegrationBar } from "./IntegrationBar";
import type { IntegrationBarProps } from "./IntegrationBar";

interface EngineVizProps {
  integrations: IntegrationBarProps[];
  activeWorkflows?: number;
  loadPercent?: string;
  threadsPerMin?: string;
  currentTask?: string | null;
  nextTask?: string | null;
}

export function EngineViz({
  integrations,
  loadPercent = "0%",
  threadsPerMin = "0/min",
  currentTask = "Waiting for activity...",
  nextTask = null,
}: EngineVizProps) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden min-h-[520px] relative inner-glow-top flex flex-col">
      <div className="scanline opacity-20"></div>

      <div className="relative z-10 px-7 pt-6 pb-4 flex items-center justify-between border-b border-outline-variant/40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-on-surface-variant/50 tracking-wider">ENGINE_CORE::ACTIVE</span>
          <div className="px-2 py-0.5 rounded border border-secondary/40 text-[10px] font-bold text-secondary uppercase tracking-wider pulse-ring">Live</div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="px-3 py-1 bg-surface-container rounded-full text-[11px] font-mono text-on-surface-variant border border-outline-variant">{`Load: ${loadPercent}`}</span>
          <span className="px-3 py-1 bg-surface-container rounded-full text-[11px] font-mono text-on-surface-variant border border-outline-variant">{`Threads: ${threadsPerMin}`}</span>
        </div>
      </div>

      <div className="relative z-10 px-7 pt-8 pb-6 flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center relative mb-6">
          <div className="absolute top-0 left-6 flex flex-col items-end gap-2 text-right">
            <div className="text-[11px] font-mono text-secondary bg-secondary/10 px-3 py-1.5 rounded-lg border border-secondary/20 whitespace-nowrap">{currentTask}</div>
            <div className="w-px h-14 bg-gradient-to-b from-secondary/60 to-transparent mr-3"></div>
          </div>
          {nextTask && (
            <div className="absolute bottom-0 right-6 flex flex-col items-start gap-2 text-left">
              <div className="w-px h-14 bg-gradient-to-t from-primary/60 to-transparent ml-3"></div>
              <div className="text-[11px] font-mono text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 whitespace-nowrap">{nextTask}</div>
            </div>
          )}

          <div className="absolute w-[340px] h-[340px] rounded-full border border-primary/5 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute w-[280px] h-[280px] animate-spin-slow top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-secondary border-2 border-surface-container-lowest flex items-center justify-center shadow-[0_0_10px_rgba(78,222,163,0.4)]">
              <span className="material-symbols-outlined text-surface text-[12px] font-bold">bolt</span>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-tertiary border-2 border-surface-container-lowest flex items-center justify-center shadow-[0_0_10px_rgba(255,178,183,0.4)]">
              <span className="material-symbols-outlined text-surface text-[12px] font-bold">bug_report</span>
            </div>
          </div>
          <div className="absolute w-[200px] h-[200px] animate-spin-reverse top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute top-1/2 -left-2.5 w-5 h-5 rounded bg-primary shadow-[0_0_12px_rgba(192,193,255,0.5)] border border-primary/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-surface text-[12px]">code</span>
            </div>
            <div className="absolute bottom-1/2 -right-2.5 w-5 h-5 rounded bg-secondary shadow-[0_0_12px_rgba(78,222,163,0.5)] border border-secondary/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-surface text-[12px]">book</span>
            </div>
          </div>

          <div className="w-28 h-28 rounded-full border border-primary/30 flex items-center justify-center glow-primary bg-surface-container-high/60 backdrop-blur-xl">
            <div className="w-20 h-20 rounded-full border-2 border-primary/15 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>insights</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-auto">
          {integrations.map((int) => (
            <IntegrationBar key={int.label} {...int} />
          ))}
        </div>
      </div>
    </section>
  );
}
