import { useEffect, useRef, useState } from "react";
import { getAgentEvents, type AgentEventQuery } from "../api/activity";
import type { AgentEvent } from "../api/types";

const DEFAULT_INTERVAL_MS = 3000;
const MAX_EVENTS = 100;

export function useAgentEvents(params?: AgentEventQuery, intervalMs: number = DEFAULT_INTERVAL_MS) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const paramsRef = useRef(params);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const next = await getAgentEvents(paramsRef.current);
        if (!active) return;
        setEvents(next.slice(0, MAX_EVENTS));
      } catch {
        // silent — polling is best-effort, keep last state
      } finally {
        if (active) setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, intervalMs);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [intervalMs]);

  return { events, loading };
}
