// Core domain types for the Warrant engine.
// These are pure type/interface declarations — no runtime logic lives here.
//
// The engine was ported from a static, three-task-type world into a
// config-driven one. The original literal `TaskType` union is retained
// because the deterministic scorer (scorer.ts, the optional "structured
// scoring" strategy) is defined per known task type. The router, by
// contrast, works against the generalized `RoutableTask` / `RoutableWorker`
// shapes below, whose `type` is an arbitrary string — so tasks and workers
// loaded from tenant config/DB (see db-types.ts) route without being bound
// to any fixed enum.

/** Known task types with a built-in structured scorer (see scorer.ts). */
export type TaskType = "email_triage" | "invoice_extraction" | "report_summary";

export type Reversibility = "reversible" | "irreversible";

export type WorkerKind = "human" | "agent";

/** Human-suitability axes, each scored 0..1. */
export type HumanAxes = {
  nuance: number;
  crossDomain: number;
  unbiasedPushback: number;
  emotionalStakes: number;
  trust: number;
};

/** AI-suitability axes, each scored 0..1. */
export type AIAxes = {
  multiStepDecisioning: number;
  contextCapacity: number;
  salienceWeighing: number;
};

export type Task = {
  id: string;
  type: TaskType;
  title: string;
  input: string;
  difficulty: "easy" | "medium" | "hard";
  reversibility: Reversibility;
  humanAxes: HumanAxes;
  aiAxes: AIAxes;
  groundTruth: unknown;
};

export type Worker = {
  id: string;
  kind: WorkerKind;
  name: string;
  /** LLM provider key for agent workers (e.g. "openai"); resolved via substrate.getProvider. */
  provider?: string;
  modelId?: string;
  humanAxes: HumanAxes;
  aiAxes: AIAxes;
  costPerTaskUSD: number;
  typicalLatencySec: number;
};

/**
 * The minimal task shape the router needs. `type` is an arbitrary string so
 * config-driven task types route without a fixed enum. A full `Task` is
 * structurally assignable to this.
 */
export type RoutableTask = {
  id: string;
  type: string;
  reversibility: Reversibility;
  humanAxes: HumanAxes;
  aiAxes: AIAxes;
};

/**
 * The minimal worker shape the router needs. A full `Worker` is structurally
 * assignable to this, as is any worker row hydrated from tenant config.
 */
export type RoutableWorker = {
  id: string;
  kind: WorkerKind;
  name: string;
  humanAxes: HumanAxes;
  aiAxes: AIAxes;
  costPerTaskUSD: number;
  typicalLatencySec: number;
};

/** Beta distribution parameters for a (worker, task_type) reliability posterior. */
export type Posterior = {
  alpha: number;
  beta: number;
};

export type AllocationMode =
  | "agent_solo"
  | "human_solo"
  | "agent_proposes_human_approves";

export type EvidenceEvent = {
  ts: string;
  type:
    | "allocation"
    | "execution"
    | "outcome"
    | "posterior_update"
    | "gate_halt"
    | "approval"
    | "test_result";
  [k: string]: unknown;
};

/** Weighted per-axis contributions to a worker's score, for the rationale panel. */
export type ScoreParts = {
  axis: number;
  cost: number;
  latency: number;
  reliability: number;
};

export type WorkerScore = {
  workerId: string;
  score: number;
  parts: ScoreParts;
};

export type AllocationTrigger = "none" | "risk" | "capability" | "judgment";

export type Allocation = {
  taskId: string;
  mode: AllocationMode;
  workerId: string;
  trigger: AllocationTrigger;
  scores: WorkerScore[];
  rationale: string;
};
