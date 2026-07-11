"use client";

import { useMemo } from "react";
import type { WorkerScore } from "@/lib/types";
import { Badge } from "./badge";
import { fmt2 } from "./format";

/**
 * The routing evidence: every candidate with its total score and the four
 * weighted parts. The chosen worker's row carries a sky left border and a
 * surface fill — selection, not celebration.
 */
export function ScoreBreakdown({
  scores,
  chosenId,
  workerName,
}: {
  scores: WorkerScore[];
  chosenId: string;
  workerName: (id: string) => string;
}) {
  const rows = useMemo(() => [...scores].sort((a, b) => b.score - a.score), [scores]);

  return (
    <div className="space-y-1.5">
      {rows.map((s) => {
        const chosen = s.workerId === chosenId;
        return (
          <div
            key={s.workerId}
            className={`rounded-md border-l-[3px] px-3 py-2.5 ${
              chosen ? "border-sky-line bg-surface" : "border-transparent"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
                {workerName(s.workerId)}
                {chosen && <Badge tone="sky">chosen</Badge>}
              </span>
              <span className="font-mono text-[14px] tabular-nums text-ink">{fmt2(s.score)}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-ink-3">
              <span>axis {fmt2(s.parts.axis)}</span>
              <span>cost {fmt2(s.parts.cost)}</span>
              <span>latency {fmt2(s.parts.latency)}</span>
              <span>reliability {fmt2(s.parts.reliability)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
