"use client";

import { useMemo } from "react";
import type { ReputationRow } from "../lib/client";
import { AnimatedNumber, DataBar } from "./data-bar";
import { fmt2 } from "./format";

function fmtParam(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Reliability as a Beta posterior mean per (worker, task type), grouped by
 * worker. The mean counts to its new value and its bar scales on refresh — the
 * one place a number visibly moves, because "reliability learned" is the thesis.
 */
export function ReputationPanel({
  rows,
  workerName,
  typeName,
}: {
  rows: ReputationRow[];
  workerName: (id: string) => string;
  typeName: (id: string) => string;
}) {
  const groups = useMemo(() => {
    const byWorker = new Map<string, ReputationRow[]>();
    for (const r of rows) {
      const list = byWorker.get(r.workerId) ?? [];
      list.push(r);
      byWorker.set(r.workerId, list);
    }
    return Array.from(byWorker.entries())
      .map(([workerId, list]) => ({
        workerId,
        name: workerName(workerId),
        rows: [...list].sort((a, b) => typeName(a.taskTypeId).localeCompare(typeName(b.taskTypeId))),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, workerName, typeName]);

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <div key={g.workerId} className="space-y-4">
          <div className="text-[13px] font-medium text-ink-2">{g.name}</div>
          {g.rows.map((r) => (
            <div key={`${r.workerId}:${r.taskTypeId}`} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] text-ink">{typeName(r.taskTypeId)}</span>
                <AnimatedNumber
                  value={r.mean}
                  format={fmt2}
                  className="font-mono text-[13px] tabular-nums text-ink"
                />
              </div>
              <DataBar value={r.mean} variant="reliability" />
              <div className="font-mono text-[12px] text-ink-3">
                α={fmtParam(r.alpha)} · β={fmtParam(r.beta)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
