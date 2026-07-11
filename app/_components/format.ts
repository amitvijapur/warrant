// Pure formatting + label helpers shared across the console. No React here —
// just the mapping from backend values to the words and tones the UI shows.

import type {
  AllocationMode,
  AllocationTrigger,
} from "@/lib/types";
import type { AssignmentStatus, TaskStatus } from "@/lib/db-types";

/** Semantic tones — each maps to a pastel triad in brand.md. */
export type Tone =
  | "neutral"
  | "sky"
  | "mint"
  | "butter"
  | "blush"
  | "lavender"
  | "peach";

// ── Numbers ────────────────────────────────────────────────────────────────

/** Money as `$0.0000` (4dp: agent costs are sub-cent and must not read $0.00). */
export function fmtUSD(n: number | null | undefined): string {
  return n == null ? "—" : `$${n.toFixed(4)}`;
}

/** Observed latency in whole milliseconds, e.g. `812ms`. */
export function fmtMs(ms: number | null | undefined): string {
  return ms == null ? "—" : `${Math.round(ms)}ms`;
}

/** Typical latency in seconds, e.g. `~3s`. */
export function fmtSec(s: number | null | undefined): string {
  return s == null ? "—" : `~${s % 1 === 0 ? s : s.toFixed(1)}s`;
}

/** Scores, means, reliabilities — always two decimals. */
export function fmt2(n: number | null | undefined): string {
  return n == null ? "—" : n.toFixed(2);
}

// ── Time ─────────────────────────────────────────────────────────────────

/** A short relative label ("just now", "4m ago", "2h ago", "3d ago", date). */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const s = Math.round(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Full timestamp for a `title` tooltip. */
export function absoluteTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

// ── Routing vocabulary ─────────────────────────────────────────────────────

/** How a task was allocated, in plain language. */
export function modeLabel(mode: AllocationMode): string {
  switch (mode) {
    case "agent_solo":
      return "Agent · autonomous";
    case "human_solo":
      return "Human operator";
    case "agent_proposes_human_approves":
      return "Agent proposes · human approves";
  }
}

export type TriggerMeta = { label: string; tone: Tone; gloss: string };

/** The condition that shaped the route, its chip tone, and a one-line gloss. */
export function triggerMeta(trigger: AllocationTrigger): TriggerMeta {
  switch (trigger) {
    case "none":
      return {
        label: "score-based",
        tone: "neutral",
        gloss: "No special condition fired — the highest-scoring worker was chosen.",
      };
    case "capability":
      return {
        label: "capability pairing",
        tone: "sky",
        gloss: "Routed on a capability match between this task type and the worker.",
      };
    case "judgment":
      return {
        label: "judgment → human",
        tone: "lavender",
        gloss: "This task needs human judgment; no agent scored competitively.",
      };
    case "risk":
      return {
        label: "risk → human-in-the-loop",
        tone: "butter",
        gloss: "An irreversible action — a person must approve before it can run.",
      };
  }
}

// ── Status vocabulary ──────────────────────────────────────────────────────

export type StatusMeta = { label: string; tone: Tone };

export function taskStatusMeta(status: TaskStatus): StatusMeta {
  switch (status) {
    case "pending":
      return { label: "Pending", tone: "neutral" };
    case "assigned":
      return { label: "Assigned", tone: "neutral" };
    case "awaiting_approval":
      return { label: "Awaiting approval", tone: "butter" };
    case "completed":
      return { label: "Completed", tone: "mint" };
    case "failed":
      return { label: "Failed", tone: "blush" };
  }
}

export function assignmentStatusMeta(status: AssignmentStatus): StatusMeta {
  switch (status) {
    case "proposed":
      return { label: "Proposed", tone: "neutral" };
    case "running":
      return { label: "Running", tone: "neutral" };
    case "awaiting_approval":
      return { label: "Awaiting approval", tone: "butter" };
    case "completed":
      return { label: "Completed", tone: "mint" };
    case "rejected":
      return { label: "Rejected", tone: "blush" };
    case "failed":
      return { label: "Failed", tone: "blush" };
  }
}

// ── Axis labels (worker suitability & task-type requirements) ───────────────

export const HUMAN_AXES: { key: string; label: string }[] = [
  { key: "nuance", label: "Nuance" },
  { key: "crossDomain", label: "Cross-domain" },
  { key: "unbiasedPushback", label: "Unbiased pushback" },
  { key: "emotionalStakes", label: "Emotional stakes" },
  { key: "trust", label: "Trust" },
];

export const AI_AXES: { key: string; label: string }[] = [
  { key: "multiStepDecisioning", label: "Multi-step decisioning" },
  { key: "contextCapacity", label: "Context capacity" },
  { key: "salienceWeighing", label: "Salience weighing" },
];
