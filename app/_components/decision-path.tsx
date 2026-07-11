"use client";

import type { AllocationMode, AllocationTrigger } from "@/lib/types";
import { CAPABILITY_TRIGGER_THRESHOLD } from "@/lib/config";
import { fmt2, modeLabel } from "./format";

type StepState = "fired" | "passed" | "unreached";

const T = CAPABILITY_TRIGGER_THRESHOLD;

function mean(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

/**
 * The router's trigger cascade, made legible. lib/router.ts checks four rules in
 * order; exactly one decides the route. This shows which one fired for THIS task
 * and the numbers that decided it — the plain answer to "why an agent, or why a
 * person?". Values mirror the router: judgment = mean of the task's 5 human
 * axes, AI leverage = mean of its 3 AI axes, both against the same threshold.
 */
export function DecisionPath({
  trigger,
  mode,
  reversibility,
  humanAxes,
  aiAxes,
}: {
  trigger: AllocationTrigger;
  mode: AllocationMode;
  reversibility: "reversible" | "irreversible";
  humanAxes: Record<string, number>;
  aiAxes: Record<string, number>;
}) {
  const judgment = mean(Object.values(humanAxes));
  const aiLeverage = mean(Object.values(aiAxes));
  const firedIndex = { capability: 0, judgment: 1, risk: 2, none: 3 }[trigger];

  const steps: { title: string; detail: string }[] = [
    {
      title: "Capability pairing",
      detail: `Judgment ${fmt2(judgment)} and AI leverage ${fmt2(aiLeverage)} against ≥ ${fmt2(T)} — when a task needs both, an agent proposes and a person approves.`,
    },
    {
      title: "Judgment → human",
      detail: `Judgment ${fmt2(judgment)} ≥ ${fmt2(T)} with AI leverage ${fmt2(aiLeverage)} below it — this goes to a person by rule; the router doesn't price-shop it.`,
    },
    {
      title: "Risk gate",
      detail:
        reversibility === "irreversible"
          ? "This action is irreversible — if an agent acts, a person must approve it first."
          : "This action is reversible — no approval gate is required.",
    },
    {
      title: "Best score wins",
      detail: "No special rule applied — the highest-scoring worker takes the task.",
    },
  ];

  return (
    <ol className="space-y-1">
      {steps.map((step, i) => {
        const state: StepState = i === firedIndex ? "fired" : i < firedIndex ? "passed" : "unreached";
        return (
          <li
            key={step.title}
            className={`flex gap-3 rounded-md px-3 py-2 ${state === "fired" ? "bg-surface" : ""}`}
          >
            <span aria-hidden className="mt-[5px] flex size-3 shrink-0 items-center justify-center">
              {state === "fired" ? (
                <span className="size-2.5 rounded-full bg-ink" />
              ) : state === "passed" ? (
                <span className="size-2.5 rounded-full border border-ink-3" />
              ) : (
                <span className="size-2.5 rounded-full border border-divider" />
              )}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2">
                <span
                  className={`text-[14px] ${
                    state === "unreached"
                      ? "text-ink-3"
                      : state === "fired"
                        ? "font-medium text-ink"
                        : "text-ink-2"
                  }`}
                >
                  {step.title}
                </span>
                {state === "fired" && (
                  <span className="text-[12px] text-ink-3">→ {modeLabel(mode)}</span>
                )}
              </div>
              {state !== "unreached" && (
                <p
                  className={`mt-0.5 text-[13px] leading-[1.5] ${
                    state === "fired" ? "text-ink-2" : "text-ink-3"
                  }`}
                >
                  {step.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
