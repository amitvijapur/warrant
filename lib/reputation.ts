// Reliability reputation: folds a company's recorded outcomes into a
// per-(worker, taskType) Beta posterior the router can consult.
//
// The fold reuses lib/posterior.ts and NEVER resets: starting from Beta(1,1)
// and applying one conjugate update per outcome yields Beta(1 + successes,
// 1 + failures), where the verdict for each outcome is the human confirmation
// if present, else the automated judge's pass — i.e. `confirmed_pass ?? judge_pass`.

import { newPosterior, update } from "./posterior";
import { outcomeRepo } from "./repos";
import type { ReputationLookup } from "./router";
import type { Posterior } from "./types";
import type { Outcome } from "./db-types";

/** Map keyed `${workerId}:${taskTypeId}` -> reliability posterior. */
export type ReputationMap = Map<string, Posterior>;

function keyFor(workerId: string, taskTypeId: string): string {
  return `${workerId}:${taskTypeId}`;
}

/** The final verdict for an outcome: human confirmation overrides the judge. */
export function verdictOf(outcome: Pick<Outcome, "judgePass" | "confirmedPass">): boolean {
  return outcome.confirmedPass ?? outcome.judgePass;
}

/** The fields foldOutcomes reads, plus the identity/ordering fields it dedupes on. */
type FoldableOutcome = Pick<
  Outcome,
  "assignmentId" | "workerId" | "taskTypeId" | "judgePass" | "confirmedPass" | "createdAt"
>;

/**
 * Pure fold: outcomes -> reputation map. Kept DB-free so it can be unit-tested
 * against fabricated outcomes. Each (worker, taskType) bucket starts at
 * Beta(1,1) and accretes one update per outcome; order does not matter.
 *
 * A retried/flaky judge can write more than one outcome row for the same
 * assignment; those would otherwise be double-counted. De-duplicate by
 * assignmentId first (latest createdAt wins — ISO-8601 sorts lexicographically)
 * so exactly one verdict per assignment is folded.
 */
export function foldOutcomes(outcomes: FoldableOutcome[]): ReputationMap {
  const latestByAssignment = new Map<string, FoldableOutcome>();
  for (const outcome of outcomes) {
    const existing = latestByAssignment.get(outcome.assignmentId);
    if (!existing || outcome.createdAt >= existing.createdAt) {
      latestByAssignment.set(outcome.assignmentId, outcome);
    }
  }

  const map: ReputationMap = new Map();
  for (const outcome of latestByAssignment.values()) {
    const key = keyFor(outcome.workerId, outcome.taskTypeId);
    const current = map.get(key) ?? newPosterior();
    map.set(key, update(current, verdictOf(outcome)));
  }
  return map;
}

/** Loads a company's outcomes and folds them into a reputation map. */
export async function buildReputation(companyId: string): Promise<ReputationMap> {
  const outcomes = await outcomeRepo.listByCompany(companyId);
  return foldOutcomes(outcomes);
}

/**
 * Adapts a reputation map into the router's ReputationLookup. Unknown
 * (worker, taskType) pairs fall back to the Beta(1,1) cold-start prior.
 */
export function reputationForFrom(map: ReputationMap): ReputationLookup {
  return (workerId: string, taskType: string): Posterior =>
    map.get(keyFor(workerId, taskType)) ?? newPosterior();
}
