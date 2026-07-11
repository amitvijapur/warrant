"use client";

import type { ReactNode } from "react";

/** Stepper node states: done (ink), the active decision (dot), a gate awaiting a
 *  person (butter), or an upcoming stage (hollow). */
type NodeState = "done" | "active" | "gate" | "idle";

const NODE: Record<NodeState, string> = {
  done: "border-ink bg-ink",
  active: "border-dot bg-dot",
  gate: "border-butter-line bg-butter-line",
  idle: "border-border bg-paper",
};

/** One stage in the Overview run-trace: a node on the left rail, a title, and
 *  its content. Reveal each stage once — prior stages stay visible as evidence. */
export function Stage({
  node,
  title,
  last = false,
  animate = false,
  children,
}: {
  node: NodeState;
  title: string;
  last?: boolean;
  animate?: boolean;
  children: ReactNode;
}) {
  return (
    <li className={`relative pl-9 ${animate ? "animate-stage-in" : ""}`}>
      {!last && (
        <span aria-hidden className="absolute bottom-1 left-[10px] top-7 w-px bg-divider" />
      )}
      <span
        aria-hidden
        className={`absolute left-1 top-0.5 size-3 rounded-full border transition-colors duration-[180ms] ${NODE[node]}`}
      />
      <div className="pb-9">
        <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">
          {title}
        </div>
        {children}
      </div>
    </li>
  );
}
