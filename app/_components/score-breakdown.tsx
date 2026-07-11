"use client";

import { useMemo } from "react";
import type { ScoreParts, WorkerScore } from "@/lib/types";
import { ROUTER_WEIGHTS } from "@/lib/config";
import { Badge } from "./badge";
import { fmt2 } from "./format";

/**
 * The four scoring dimensions in a fixed order shared by the legend and the
 * stacked contribution bars. Colour encodes the dimension (a data mapping, not
 * decoration); the weight is the fixed multiplier every candidate is scored by.
 */
const DIMENSIONS: { key: keyof ScoreParts; label: string; swatch: string }[] = [
  { key: "axis", label: "capability", swatch: "bg-sky-line" },
  { key: "reliability", label: "track record", swatch: "bg-lavender-line" },
  { key: "cost", label: "cost", swatch: "bg-mint-line" },
  { key: "latency", label: "speed", swatch: "bg-butter-line" },
];

/** The two dimensions that contributed most to a worker's total score. */
function topTwo(parts: ScoreParts): Set<keyof ScoreParts> {
  const ordered = (Object.keys(parts) as (keyof ScoreParts)[]).sort(
    (a, b) => parts[b] - parts[a],
  );
  return new Set([ordered[0], ordered[1]]);
}

/**
 * The routing evidence: every candidate with its total score, a stacked bar of
 * the four weighted contributions (each segment's width IS that contribution,
 * out of a possible 1.00), and the numbers — with the two decisive dimensions
 * emphasised. The chosen worker's row carries a sky border and surface fill.
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {DIMENSIONS.map((d) => (
          <span key={d.key} className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
            <span aria-hidden className={`size-2 rounded-[2px] ${d.swatch}`} />
            {d.label}
            <span className="font-mono text-ink-2">×{fmt2(ROUTER_WEIGHTS[d.key])}</span>
          </span>
        ))}
      </div>

      <div className="space-y-1.5">
        {rows.map((s) => {
          const chosen = s.workerId === chosenId;
          const decisive = topTwo(s.parts);
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

              <div
                className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-raised"
                role="img"
                aria-label={`total score ${fmt2(s.score)} of 1.00`}
              >
                {DIMENSIONS.map((d) => (
                  <div
                    key={d.key}
                    className={`h-full ${d.swatch}`}
                    style={{ width: `${Math.max(0, s.parts[d.key]) * 100}%` }}
                  />
                ))}
              </div>

              <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px]">
                {DIMENSIONS.map((d) => (
                  <span key={d.key} className={decisive.has(d.key) ? "text-ink" : "text-ink-3"}>
                    {d.label} {fmt2(s.parts[d.key])}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
