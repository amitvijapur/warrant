// Hand-written TypeScript row types for the multi-tenant Supabase schema.
// These describe the persisted shape of each tenant table. The engine's
// runtime types live in ./types; where the shapes overlap (axes, allocation
// mode/trigger, per-worker scores) we reuse them so the DB layer and the
// engine can't drift.

import type {
  AIAxes,
  AllocationMode,
  AllocationTrigger,
  HumanAxes,
  Reversibility,
  WorkerKind,
  WorkerScore,
} from "./types";

/** ISO-8601 timestamp string (Postgres timestamptz serialized). */
export type Timestamp = string;

/** A tenant. Every other row is scoped by companyId. */
export type Company = {
  id: string;
  name: string;
  createdAt: Timestamp;
};

/**
 * A worker available to a company's router — a human operator or a
 * configured agent. For agents, `provider` + `model` name the LLM backing
 * the worker (see lib/substrate.ts); both are null for humans.
 */
export type Worker = {
  id: string;
  companyId: string;
  kind: WorkerKind;
  name: string;
  /** Agent only: LLM provider key resolved by substrate.getProvider (e.g. "openai"). */
  provider: string | null;
  /** Agent only: model id passed to the provider. */
  model: string | null;
  humanAxes: HumanAxes;
  aiAxes: AIAxes;
  costPerTaskUSD: number;
  typicalLatencySec: number;
  active: boolean;
  createdAt: Timestamp;
};

/**
 * A company-defined kind of task, carrying the requirement profile the
 * router matches workers against plus the acceptance criteria a judge scores
 * completed work against.
 */
export type TaskType = {
  id: string;
  companyId: string;
  name: string;
  description: string;
  requiredHumanAxes: HumanAxes;
  requiredAiAxes: AIAxes;
  reversibility: Reversibility;
  acceptanceCriteria: string;
  createdAt: Timestamp;
};

export type TaskStatus =
  | "pending"
  | "assigned"
  | "awaiting_approval"
  | "completed"
  | "failed";

/** A concrete unit of work of a given TaskType. */
export type Task = {
  id: string;
  companyId: string;
  taskTypeId: string;
  title: string;
  input: string;
  status: TaskStatus;
  /** Optional expected-answer contract for the structured scorer; null when unscored. */
  groundTruth: unknown | null;
  createdAt: Timestamp;
};

export type AssignmentStatus =
  | "proposed"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "rejected"
  | "failed";

/**
 * The router's decision for a task plus its execution result: which worker,
 * in which mode, why (rationale + per-worker scores), and — once run — the
 * produced output with observed cost and latency.
 */
export type Assignment = {
  id: string;
  companyId: string;
  taskId: string;
  workerId: string;
  mode: AllocationMode;
  trigger: AllocationTrigger;
  scores: WorkerScore[];
  rationale: string;
  status: AssignmentStatus;
  output: string | null;
  costUSD: number | null;
  latencyMs: number | null;
  createdAt: Timestamp;
};

/**
 * The verdict on a completed assignment: the automated judge's pass/detail,
 * plus an optional human confirmation that overrides or ratifies it.
 *
 * The denormalized taskId / workerId / taskTypeId columns (present on the
 * `outcome` table) are carried here so the reliability fold in
 * lib/reputation.ts can bucket every verdict by (workerId, taskTypeId)
 * without re-joining back through assignment → task.
 */
export type Outcome = {
  id: string;
  companyId: string;
  assignmentId: string;
  taskId: string;
  workerId: string;
  taskTypeId: string;
  judgePass: boolean;
  judgeDetail: string;
  confirmedPass: boolean | null;
  confirmedBy: string | null;
  createdAt: Timestamp;
};
