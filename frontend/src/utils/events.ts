import type { EventLevel } from "../api/types";

const PREFIX_LABELS: Array<[string, string]> = [
  ["ingest_", "Ingest"],
  ["research_", "Research"],
  ["memory_", "Memory"],
  ["review_", "Review"],
  ["write_", "Write"],
  ["synthesize_", "Synthesis"],
  ["publish_", "Publish"],
  ["human_review_", "Human Review"],
  ["verify_", "Verify"],
];

const EXACT_LABELS: Record<string, string> = {
  workflow_created: "Workflow",
};

export function eventTypeLabel(eventType: string): string {
  if (EXACT_LABELS[eventType]) return EXACT_LABELS[eventType];
  if (eventType.includes("_pipeline_")) return "Pipeline";
  for (const [prefix, label] of PREFIX_LABELS) {
    if (eventType.startsWith(prefix)) return label;
  }
  return humanize(eventType);
}

function humanize(raw: string): string {
  const cleaned = raw.replace(/[_-]+/g, " ");
  if (!cleaned) return raw;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function levelTone(level: EventLevel): { badge: string; dot: string } {
  switch (level) {
    case "error":
      return { badge: "bg-error/15 text-error", dot: "bg-error" };
    case "warning":
      return { badge: "bg-warning/15 text-warning", dot: "bg-warning" };
    default:
      return { badge: "bg-primary/15 text-primary", dot: "bg-primary" };
  }
}

export function formatEventTime(iso: string | null): string {
  if (!iso) return "--:--:--";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const DETAIL_SUMMARY_KEYS = ["question", "title", "message", "summary", "node", "source"];

export function eventDetailSummary(details: Record<string, unknown> | null | undefined): string | null {
  if (!details) return null;
  for (const key of DETAIL_SUMMARY_KEYS) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) {
      return value.slice(0, 80);
    }
  }
  return null;
}
