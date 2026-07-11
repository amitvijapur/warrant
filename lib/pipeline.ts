// Pipeline: the orchestration layer that wires the repos (DB I/O) to the pure
// engine (router, gate, substrate) and the LLM helpers (classify, judge).
//
// Flow: submitTask (classify -> persist) -> routeTask (route -> persist an
// assignment) -> executeAssignment / submitHumanOutput / approveAndExecute
// (run + judge) -> confirmOutcome (human ratifies/overrides the judge).
//
// The Authority Gate invariant is preserved here: an irreversible agent
// assignment is NEVER executed by executeAssignment — the sole path that runs
// one is approveAndExecute, which mints a signed ApprovalToken and drives the
// execution through gate.executeIrreversible.

import type { Allocation, RoutableTask, RoutableWorker } from "./types";
import type {
  Task as EngineTask,
  TaskType as EngineTaskTypeLiteral,
  Worker as EngineWorker,
} from "./types";
import type {
  Assignment,
  AssignmentStatus,
  Outcome,
  Task,
  TaskStatus,
  TaskType,
  Worker,
} from "./db-types";

import { classifyTask, type Classification } from "./classify";
import { appendEvidence } from "./evidence";
import { executeIrreversible, mintApprovalToken } from "./gate";
import { judgeOutput } from "./judge";
import { buildReputation, reputationForFrom } from "./reputation";
import { repos } from "./repos";
import { route } from "./router";
import { buildAgentPrompt, executeTask } from "./substrate";

// ---------------------------------------------------------------------------
// Engine adapters: DB rows -> the pure engine's Task/Worker shapes.
// ---------------------------------------------------------------------------

function toEngineWorker(worker: Worker): EngineWorker {
  return {
    id: worker.id,
    kind: worker.kind,
    name: worker.name,
    provider: worker.provider ?? undefined,
    modelId: worker.model ?? undefined,
    humanAxes: worker.humanAxes,
    aiAxes: worker.aiAxes,
    costPerTaskUSD: worker.costPerTaskUSD,
    typicalLatencySec: worker.typicalLatencySec,
  };
}

/**
 * Build an engine Task for execution. `input` is the composed generic prompt
 * (from buildAgentPrompt), so the substrate/gate reconstruct the same prompt.
 * The engine's literal `type` union does not describe tenant task types, so the
 * task_type_id is carried through a cast; substrate's default prompt path keys
 * off `input`, not this field.
 */
function toEngineTask(task: Task, taskType: TaskType, input: string): EngineTask {
  return {
    id: task.id,
    type: task.taskTypeId as unknown as EngineTaskTypeLiteral,
    title: task.title,
    input,
    difficulty: "medium",
    reversibility: taskType.reversibility,
    humanAxes: taskType.requiredHumanAxes,
    aiAxes: taskType.requiredAiAxes,
    groundTruth: task.groundTruth,
  };
}

function toRoutableTask(task: Task, taskType: TaskType): RoutableTask {
  return {
    id: task.id,
    type: task.taskTypeId,
    reversibility: taskType.reversibility,
    humanAxes: taskType.requiredHumanAxes,
    aiAxes: taskType.requiredAiAxes,
  };
}

function toRoutableWorker(worker: Worker): RoutableWorker {
  return {
    id: worker.id,
    kind: worker.kind,
    name: worker.name,
    humanAxes: worker.humanAxes,
    aiAxes: worker.aiAxes,
    costPerTaskUSD: worker.costPerTaskUSD,
    typicalLatencySec: worker.typicalLatencySec,
  };
}

// ---------------------------------------------------------------------------
// Result shapes.
// ---------------------------------------------------------------------------

export type SubmitTaskResult = { task: Task; classification: Classification };
export type RouteTaskResult = { assignment: Assignment; allocation: Allocation };

export type ExecuteAssignmentResult =
  | { status: "completed"; assignment: Assignment; outcome: Outcome }
  | { status: "gate_required"; assignment: Assignment }
  | { status: "human_work_item"; assignment: Assignment };

export type ApproveAndExecuteResult = { assignment: Assignment; outcome: Outcome };
export type SubmitHumanOutputResult = { assignment: Assignment; outcome: Outcome };

// ---------------------------------------------------------------------------
// Orchestration.
// ---------------------------------------------------------------------------

/** Classify a free-text task, then persist it as a pending task of the chosen type. */
export async function submitTask(
  companyId: string,
  title: string,
  input: string,
): Promise<SubmitTaskResult> {
  const taskTypes = await repos.taskType.list(companyId);
  const classification = await classifyTask(input, taskTypes);
  const task = await repos.task.create({
    companyId,
    taskTypeId: classification.taskTypeId,
    title,
    input,
    status: "pending",
    groundTruth: null,
  });
  return { task, classification };
}

/** Decide the assignment + task statuses from the allocation and reversibility. */
function statusesFor(
  allocation: Allocation,
  reversibility: TaskType["reversibility"],
): { assignmentStatus: AssignmentStatus; taskStatus: TaskStatus } {
  // Any irreversible agent action OR a capability/risk pairing gates on human
  // approval; agent_solo (reversible) and human_solo become live work items.
  if (allocation.mode === "agent_proposes_human_approves") {
    return { assignmentStatus: "awaiting_approval", taskStatus: "awaiting_approval" };
  }
  if (allocation.mode === "agent_solo") {
    if (reversibility === "irreversible") {
      return { assignmentStatus: "awaiting_approval", taskStatus: "awaiting_approval" };
    }
    return { assignmentStatus: "running", taskStatus: "assigned" };
  }
  // human_solo — a human work item.
  return { assignmentStatus: "running", taskStatus: "assigned" };
}

/** Route a pending task: score workers, persist an assignment, advance statuses. */
export async function routeTask(taskId: string): Promise<RouteTaskResult> {
  const task = await repos.task.get(taskId);
  if (!task) throw new Error(`routeTask: task ${taskId} not found`);
  const taskType = await repos.taskType.get(task.taskTypeId);
  if (!taskType) throw new Error(`routeTask: task type ${task.taskTypeId} not found`);

  const workers = await repos.worker.list(task.companyId, true);
  if (workers.length === 0) throw new Error(`routeTask: company ${task.companyId} has no active workers`);

  const reputationMap = await buildReputation(task.companyId);
  const reputationFor = reputationForFrom(reputationMap);

  const allocation = route(
    toRoutableTask(task, taskType),
    workers.map(toRoutableWorker),
    reputationFor,
  );

  const { assignmentStatus, taskStatus } = statusesFor(allocation, taskType.reversibility);

  const assignment = await repos.assignment.create({
    companyId: task.companyId,
    taskId: task.id,
    workerId: allocation.workerId,
    mode: allocation.mode,
    trigger: allocation.trigger,
    scores: allocation.scores,
    rationale: allocation.rationale,
    status: assignmentStatus,
  });
  await repos.task.updateStatus(task.id, taskStatus);

  return { assignment, allocation };
}

/**
 * Execute an assignment.
 *  - agent + reversible: run through the substrate, store result, judge.
 *  - agent + irreversible: refuse (gate_required) — must go via approveAndExecute.
 *  - human: return a human-work-item marker; no execution happens here.
 */
export async function executeAssignment(assignmentId: string): Promise<ExecuteAssignmentResult> {
  const assignment = await repos.assignment.get(assignmentId);
  if (!assignment) throw new Error(`executeAssignment: assignment ${assignmentId} not found`);

  const worker = await repos.worker.get(assignment.workerId);
  if (!worker) throw new Error(`executeAssignment: worker ${assignment.workerId} not found`);

  if (worker.kind === "human") {
    return { status: "human_work_item", assignment };
  }

  const task = await repos.task.get(assignment.taskId);
  if (!task) throw new Error(`executeAssignment: task ${assignment.taskId} not found`);
  const taskType = await repos.taskType.get(task.taskTypeId);
  if (!taskType) throw new Error(`executeAssignment: task type ${task.taskTypeId} not found`);

  if (taskType.reversibility === "irreversible") {
    // The gate is the flagship invariant: an irreversible agent execution may
    // only proceed through approveAndExecute with a signed ApprovalToken.
    return { status: "gate_required", assignment };
  }

  const prompt = buildAgentPrompt(taskType, task.input);
  const engineTask = toEngineTask(task, taskType, prompt.user);
  const result = await executeTask(engineTask, toEngineWorker(worker), prompt);

  const updated = await repos.assignment.update(assignmentId, {
    output: result.output,
    costUSD: result.costUSD ?? null,
    latencyMs: result.latencyMs,
    status: "completed",
  });
  await repos.task.updateStatus(task.id, "completed");

  const outcome = await judgeAssignment(assignmentId);
  return { status: "completed", assignment: updated, outcome };
}

/** Store a human worker's output, complete the assignment, and judge it. */
export async function submitHumanOutput(
  assignmentId: string,
  output: string,
): Promise<SubmitHumanOutputResult> {
  const assignment = await repos.assignment.get(assignmentId);
  if (!assignment) throw new Error(`submitHumanOutput: assignment ${assignmentId} not found`);

  const updated = await repos.assignment.update(assignmentId, { output, status: "completed" });
  await repos.task.updateStatus(assignment.taskId, "completed");

  const outcome = await judgeAssignment(assignmentId);
  return { assignment: updated, outcome };
}

/** Judge a completed assignment's stored output against its acceptance criteria. */
export async function judgeAssignment(assignmentId: string): Promise<Outcome> {
  const assignment = await repos.assignment.get(assignmentId);
  if (!assignment) throw new Error(`judgeAssignment: assignment ${assignmentId} not found`);
  if (assignment.output === null) {
    throw new Error(`judgeAssignment: assignment ${assignmentId} has no output to judge`);
  }

  const task = await repos.task.get(assignment.taskId);
  if (!task) throw new Error(`judgeAssignment: task ${assignment.taskId} not found`);
  const taskType = await repos.taskType.get(task.taskTypeId);
  if (!taskType) throw new Error(`judgeAssignment: task type ${task.taskTypeId} not found`);

  const verdict = await judgeOutput(task.input, assignment.output, taskType.acceptanceCriteria);

  return repos.outcome.create({
    companyId: assignment.companyId,
    assignmentId: assignment.id,
    taskId: task.id,
    workerId: assignment.workerId,
    taskTypeId: task.taskTypeId,
    judgePass: verdict.pass,
    judgeDetail: verdict.detail,
    confirmedPass: null,
    confirmedBy: null,
  });
}

/** Human ratifies or overrides the judge. Reputation recomputes on next buildReputation. */
export async function confirmOutcome(
  outcomeId: string,
  confirmedPass: boolean,
  confirmedBy: string,
): Promise<Outcome> {
  return repos.outcome.update(outcomeId, { confirmedPass, confirmedBy });
}

/**
 * The ONLY path that executes an irreversible agent assignment: mint a signed
 * ApprovalToken for the live human approval and drive execution through the
 * gate's executeIrreversible, then store the output and judge it.
 */
export async function approveAndExecute(
  assignmentId: string,
  approvedBy: string,
): Promise<ApproveAndExecuteResult> {
  const assignment = await repos.assignment.get(assignmentId);
  if (!assignment) throw new Error(`approveAndExecute: assignment ${assignmentId} not found`);

  const worker = await repos.worker.get(assignment.workerId);
  if (!worker) throw new Error(`approveAndExecute: worker ${assignment.workerId} not found`);
  if (worker.kind !== "agent") {
    throw new Error(`approveAndExecute: worker ${worker.id} is not an agent`);
  }

  // The approval gate only applies to an assignment that is actually awaiting
  // approval; refuse to mint a token and run the gate for anything else, so a
  // reversible / already-running / already-completed assignment can never be
  // pushed through the irreversible path.
  if (assignment.status !== "awaiting_approval") {
    throw new Error(
      `approveAndExecute: assignment ${assignmentId} is not awaiting approval (status "${assignment.status}")`,
    );
  }

  const task = await repos.task.get(assignment.taskId);
  if (!task) throw new Error(`approveAndExecute: task ${assignment.taskId} not found`);
  const taskType = await repos.taskType.get(task.taskTypeId);
  if (!taskType) throw new Error(`approveAndExecute: task type ${task.taskTypeId} not found`);

  // executeIrreversible is the irreversible path; a reversible task must never
  // travel it (it belongs on executeAssignment / the agent_solo flow).
  if (taskType.reversibility !== "irreversible") {
    throw new Error(
      `approveAndExecute: task type ${taskType.id} is reversible; the approval gate only executes irreversible tasks`,
    );
  }

  const prompt = buildAgentPrompt(taskType, task.input);
  const engineTask = toEngineTask(task, taskType, prompt.user);

  const token = mintApprovalToken(task.id, approvedBy, worker.id);

  // Best-effort audit record of the approval itself (never fails execution):
  // who approved what, when, and the nonce that correlates to this run.
  await appendEvidence({
    ts: new Date().toISOString(),
    type: "approval",
    taskId: task.id,
    assignmentId: assignment.id,
    workerId: worker.id,
    approvedBy,
    nonce: token.nonce,
  });

  const result = await executeIrreversible(engineTask, toEngineWorker(worker), token);

  const updated = await repos.assignment.update(assignmentId, {
    output: result.output,
    costUSD: result.costUSD ?? null,
    latencyMs: result.latencyMs,
    status: "completed",
  });
  await repos.task.updateStatus(task.id, "completed");

  const outcome = await judgeAssignment(assignmentId);
  return { assignment: updated, outcome };
}
