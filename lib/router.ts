// Router: turns a Task + candidate Workers + reliability posteriors into an
// Allocation. Pure functions only — no I/O.
//
// GENERALIZED away from a static worker registry: route() takes a DYNAMIC
// worker list plus a `reputationFor` lookup (workerId, taskType) => Posterior,
// so callers own where reputations come from (an in-memory map, a DB, an
// evidence log). The scoring math and the trigger cascade are IDENTICAL to
// the original: axisMatch shortfall, log-scale normCost, linear normLatency,
// reliability = posterior mean, weighted by ROUTER_WEIGHTS; then the
// capability -> judgment -> risk -> score cascade.

import { CAPABILITY_TRIGGER_THRESHOLD, ROUTER_WEIGHTS } from "./config";
import type { RouterWeights } from "./config";
import type {
  AIAxes,
  Allocation,
  AllocationMode,
  AllocationTrigger,
  HumanAxes,
  Posterior,
  RoutableTask,
  RoutableWorker,
  ScoreParts,
  WorkerScore,
} from "./types";
import { mean as posteriorMean } from "./posterior";

/** Resolves the reliability posterior for a (worker, taskType) pair. */
export type ReputationLookup = (workerId: string, taskType: string) => Posterior;

const HUMAN_AXIS_KEYS: (keyof HumanAxes)[] = [
  "nuance",
  "crossDomain",
  "unbiasedPushback",
  "emotionalStakes",
  "trust",
];

const AI_AXIS_KEYS: (keyof AIAxes)[] = [
  "multiStepDecisioning",
  "contextCapacity",
  "salienceWeighing",
];

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Shortfall-based, requirement-weighted match over all 8 axes (5 human + 3
 * AI): match = 1 − Σ_i req_i · max(0, req_i − worker_i) / Σ_i req_i.
 *
 * Interpretable: an axis the task doesn't need (req_i = 0) can never hurt
 * the score, and a worker that meets or exceeds a required axis contributes
 * zero shortfall on it. Only penalizes axes the task actually needs and the
 * worker actually falls short on.
 */
export function axisMatch(task: RoutableTask, worker: RoutableWorker): number {
  let weightedShortfall = 0;
  let totalReq = 0;

  for (const key of HUMAN_AXIS_KEYS) {
    const req = task.humanAxes[key];
    const have = worker.humanAxes[key];
    weightedShortfall += req * Math.max(0, req - have);
    totalReq += req;
  }
  for (const key of AI_AXIS_KEYS) {
    const req = task.aiAxes[key];
    const have = worker.aiAxes[key];
    weightedShortfall += req * Math.max(0, req - have);
    totalReq += req;
  }

  // A task that requires nothing on any axis can't be failed on axis fit.
  if (totalReq === 0) return 1;
  return 1 - weightedShortfall / totalReq;
}

/**
 * Log-scale cost normalization across the candidate set. Linear
 * normalization would make agent-tier cost differences (cents) vanish
 * against the human's cost (dollars); log-scale keeps them visible.
 */
export function normCost(worker: RoutableWorker, workers: RoutableWorker[]): number {
  // log10(0) is -Infinity and log10(negative)/log10(NaN) is NaN; either would
  // corrupt the score and the sort comparator. Clamp non-positive / non-finite
  // costs to a small epsilon before taking the log.
  const EPSILON = 1e-6;
  const safeCost = (c: number) => (Number.isFinite(c) && c > 0 ? c : EPSILON);

  const logCosts = workers.map((w) => Math.log10(safeCost(w.costPerTaskUSD)));
  const minLog = Math.min(...logCosts);
  const maxLog = Math.max(...logCosts);
  if (minLog === maxLog) return 0;
  const logCost = Math.log10(safeCost(worker.costPerTaskUSD));
  const result = (logCost - minLog) / (maxLog - minLog);
  return Number.isFinite(result) ? result : 0;
}

/** Linear latency normalization over [0, maxLatency] across the candidate set. */
export function normLatency(worker: RoutableWorker, workers: RoutableWorker[]): number {
  // Clamp negative / non-finite latencies (bad data) to 0 so they can never
  // produce a negative normalized latency that inflates the speed term.
  const safeLatency = (l: number) => (Number.isFinite(l) && l > 0 ? l : 0);
  const maxLatency = Math.max(...workers.map((w) => safeLatency(w.typicalLatencySec)));
  if (maxLatency <= 0) return 0;
  const result = safeLatency(worker.typicalLatencySec) / maxLatency;
  return Number.isFinite(result) ? result : 0;
}

/**
 * scoreWorker with an injectable weight set — used directly by scoreWorker
 * (with the frozen ROUTER_WEIGHTS) and by tests that need to exercise the
 * scoring math under different weights without touching the frozen config.
 */
export function scoreWorkerWith(
  weights: RouterWeights,
  task: RoutableTask,
  worker: RoutableWorker,
  posterior: Posterior,
  workers: RoutableWorker[],
): { score: number; parts: ScoreParts } {
  const axis = axisMatch(task, worker);
  const cost = normCost(worker, workers);
  const latency = normLatency(worker, workers);
  const reliability = posteriorMean(posterior);

  const parts: ScoreParts = {
    axis: weights.axis * axis,
    cost: weights.cost * (1 - cost),
    latency: weights.latency * (1 - latency),
    reliability: weights.reliability * reliability,
  };

  const score = parts.axis + parts.cost + parts.latency + parts.reliability;
  return { score, parts };
}

export function scoreWorker(
  task: RoutableTask,
  worker: RoutableWorker,
  posterior: Posterior,
  workers: RoutableWorker[],
): { score: number; parts: ScoreParts } {
  return scoreWorkerWith(ROUTER_WEIGHTS, task, worker, posterior, workers);
}

/** A scored worker carrying enough identity to build a plain-language rationale. */
type RankedWorkerScore = WorkerScore & { name: string; kind: RoutableWorker["kind"] };

const PART_LABELS: Record<keyof ScoreParts, string> = {
  axis: "capability match",
  cost: "cost efficiency",
  latency: "speed",
  reliability: "track record",
};

/** The two parts (by weighted contribution) that did the most to win it. */
function topTwoParts(parts: ScoreParts): [keyof ScoreParts, keyof ScoreParts] {
  const ordered = (Object.keys(parts) as (keyof ScoreParts)[]).sort(
    (a, b) => parts[b] - parts[a],
  );
  return [ordered[0], ordered[1]];
}

/**
 * Plain-language, 2-3 sentence explanation: why the winner won (its two
 * strongest scoring parts, compared to the runner-up by name), and why this
 * mode was chosen. No jargon, no raw numbers beyond axis values and scores
 * (rounded to 2dp).
 */
export function buildRationale(
  task: RoutableTask,
  ranked: RankedWorkerScore[],
  mode: AllocationMode,
  trigger: AllocationTrigger,
): string {
  // For a capability-triggered allocation the actual pick is the top-ranked
  // AGENT (not necessarily the overall #1), so the rationale should explain
  // that worker's win, not the overall ranking leader's.
  const winner =
    trigger === "capability"
      ? (ranked.find((r) => r.kind === "agent") ?? ranked[0])
      : ranked[0];
  const runnerUp = ranked.find((r) => r.workerId !== winner.workerId) ?? winner;

  const [firstPart, secondPart] = topTwoParts(winner.parts);
  // With a single candidate the winner and runner-up are the same worker, so a
  // comparative "ranked ahead of <same name>" clause would be misleading —
  // state the win without the comparison instead.
  const isSoloCandidate = ranked.length === 1 || runnerUp.workerId === winner.workerId;
  // In the capability case the pick is the top-ranked AGENT, which may sit
  // below the human in the overall ranking — a comparative "ranked ahead of"
  // sentence would then be visibly false on screen. Say what actually
  // happened instead.
  let sentence1: string;
  if (trigger === "capability") {
    sentence1 =
      `${winner.name} is the strongest agent for this task (score ` +
      `${winner.score.toFixed(2)}), driven mainly by ${PART_LABELS[firstPart]} ` +
      `and ${PART_LABELS[secondPart]}, but it will not act alone.`;
  } else if (isSoloCandidate) {
    sentence1 =
      `${winner.name} is the top pick (score ${winner.score.toFixed(2)}), driven mainly by ` +
      `${PART_LABELS[firstPart]} and ${PART_LABELS[secondPart]}.`;
  } else {
    sentence1 =
      `${winner.name} was ranked ahead of ${runnerUp.name} ` +
      `(${winner.score.toFixed(2)} vs ${runnerUp.score.toFixed(2)}), driven mainly by ` +
      `${PART_LABELS[firstPart]} and ${PART_LABELS[secondPart]}.`;
  }

  let sentence2: string;
  if (trigger === "capability") {
    sentence2 =
      `Paired because the task needs both human judgment (emotional stakes ` +
      `${task.humanAxes.emotionalStakes.toFixed(2)}) and AI throughput.`;
  } else if (trigger === "judgment") {
    sentence2 =
      `Assigned to a human by rule: the task demands judgment AI lacks ` +
      `(pushback ${task.humanAxes.unbiasedPushback.toFixed(2)}, trust ` +
      `${task.humanAxes.trust.toFixed(2)}) with little AI leverage, so the ` +
      `router does not price-shop it.`;
  } else if (trigger === "risk") {
    sentence2 = "Paired because the action is irreversible.";
  } else if (mode === "human_solo") {
    sentence2 =
      task.reversibility === "irreversible"
        ? "Handled solo by a human — no agent was in the running, and although the action is " +
          "irreversible it is safe because the human executes it directly, so no separate " +
          "agent-approval step applies."
        : "Handled solo by a human — no agent scored competitively enough here, and the task doesn't need pairing.";
  } else {
    sentence2 =
      "Handled solo by the agent — the task is reversible and doesn't need a paired approval step.";
  }

  return `${sentence1} ${sentence2}`;
}

export function route(
  task: RoutableTask,
  workers: RoutableWorker[],
  reputationFor: ReputationLookup,
): Allocation {
  const ranked: RankedWorkerScore[] = workers
    .map((w) => {
      const posterior = reputationFor(w.id, task.type);
      const { score, parts } = scoreWorker(task, w, posterior, workers);
      return { workerId: w.id, name: w.name, kind: w.kind, score, parts };
    })
    .sort((a, b) => b.score - a.score);

  const humanAxisMean = average(HUMAN_AXIS_KEYS.map((k) => task.humanAxes[k]));
  const aiAxisMean = average(AI_AXIS_KEYS.map((k) => task.aiAxes[k]));
  const capabilityTriggered =
    humanAxisMean >= CAPABILITY_TRIGGER_THRESHOLD && aiAxisMean >= CAPABILITY_TRIGGER_THRESHOLD;

  let mode: AllocationMode;
  let trigger: AllocationTrigger;
  let workerId: string;

  const topAgent = ranked.find((r) => r.kind === "agent");

  if (capabilityTriggered && topAgent) {
    // Capability trigger: the task genuinely needs both human judgment and
    // AI throughput, so pair the top-ranked AGENT with human approval,
    // regardless of whether a human or an agent scored highest overall.
    mode = "agent_proposes_human_approves";
    trigger = "capability";
    workerId = topAgent.workerId;
  } else if (capabilityTriggered) {
    // Capability pairing needs an agent to propose; with an all-human pool
    // there is no agent to pair, so downgrade to a solo human rather than emit
    // an unexecutable agent_proposes_human_approves pointing at a human.
    mode = "human_solo";
    trigger = "none";
    const topHuman = ranked.find((r) => r.kind === "human");
    workerId = topHuman ? topHuman.workerId : ranked[0].workerId;
  } else if (humanAxisMean >= CAPABILITY_TRIGGER_THRESHOLD && aiAxisMean < CAPABILITY_TRIGGER_THRESHOLD) {
    // Judgment trigger (symmetric with the capability trigger): the task
    // demands human judgment with little AI leverage, so it routes to the
    // human BY RULE — the router does not price-shop tasks like this.
    // Calibration showed no weight vector can both let the cheap agent win
    // cold-start extraction on cost AND let the human ever win a score
    // ranking against that same cost term; the axes decide the mode, the
    // score decides the worker within a mode. See docs/weight-calibration.md.
    mode = "human_solo";
    trigger = "judgment";
    const topHuman = ranked.find((r) => r.kind === "human");
    workerId = topHuman ? topHuman.workerId : ranked[0].workerId;
  } else if (task.reversibility === "irreversible" && ranked[0].kind === "agent") {
    // Risk trigger: this is the router's advisory signal only. The
    // structural approval gate downstream (execution layer) must
    // independently enforce human approval on irreversible + agent
    // allocations regardless of what mode the router computes here.
    mode = "agent_proposes_human_approves";
    trigger = "risk";
    workerId = ranked[0].workerId;
  } else if (ranked[0].kind === "human") {
    mode = "human_solo";
    trigger = "none";
    workerId = ranked[0].workerId;
  } else {
    mode = "agent_solo";
    trigger = "none";
    workerId = ranked[0].workerId;
  }

  const rationale = buildRationale(task, ranked, mode, trigger);

  return {
    taskId: task.id,
    mode,
    workerId,
    trigger,
    scores: ranked.map(({ workerId: id, score, parts }) => ({ workerId: id, score, parts })),
    rationale,
  };
}
