import { useEffect, useRef, useState } from "react";
import { getEventSummary } from "../api/activity";
import type { EventSummary } from "../api/types";

const DEFAULT_INTERVAL_MS = 30000;

const EMPTY_SUMMARY: EventSummary = { last_1h: {}, last_24h: {} };

export function useEventSummary(workflowId?: string, intervalMs: number = DEFAULT_INTERVAL_MS) {
  const [summary, setSummary] = useState<EventSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const workflowIdRef = useRef(workflowId);

  useEffect(() => {
    workflowIdRef.current = workflowId;
  }, [workflowId]);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const next = await getEventSummary(workflowIdRef.current);
        if (!active) return;
        setSummary(next);
      } catch {
        // silent — keep last summary
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

  return { summary, loading };
}
