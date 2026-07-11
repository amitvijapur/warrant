// Typed data-access over the server-only Supabase client. Each repo function
// is a thin, pure-ish DB I/O boundary: it maps between the snake_case columns
// of the tenant schema and the camelCase row types in lib/db-types.ts and does
// nothing else (no engine logic, no LLM calls). Higher layers (reputation,
// pipeline) compose these.

import { getSupabaseClient } from "./supabase";
import type {
  AIAxes,
  AllocationMode,
  AllocationTrigger,
  HumanAxes,
  Reversibility,
  WorkerKind,
  WorkerScore,
} from "./types";
import type {
  Assignment,
  AssignmentStatus,
  Company,
  Outcome,
  Task,
  TaskStatus,
  TaskType,
  Worker,
} from "./db-types";

/** Narrow the loosely-typed `{ data, error }` PostgREST result to `data`, throwing on error. */
function unwrap<T>(result: { data: T | null; error: { message: string } | null }, context: string): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new Error(`${context}: no data returned`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Row mappers (snake_case DB row -> camelCase domain type). Rows come back
// loosely typed from supabase-js; we read named columns and coerce numerics.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapCompany(row: any): Company {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

function mapWorker(row: any): Worker {
  return {
    id: row.id,
    companyId: row.company_id,
    kind: row.kind as WorkerKind,
    name: row.name,
    provider: row.provider ?? null,
    model: row.model ?? null,
    humanAxes: row.human_axes as HumanAxes,
    aiAxes: row.ai_axes as AIAxes,
    costPerTaskUSD: Number(row.cost_per_task_usd),
    typicalLatencySec: Number(row.typical_latency_sec),
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

function mapTaskType(row: any): TaskType {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description,
    requiredHumanAxes: row.required_human_axes as HumanAxes,
    requiredAiAxes: row.required_ai_axes as AIAxes,
    reversibility: row.reversibility as Reversibility,
    acceptanceCriteria: row.acceptance_criteria,
    createdAt: row.created_at,
  };
}

function mapTask(row: any): Task {
  return {
    id: row.id,
    companyId: row.company_id,
    taskTypeId: row.task_type_id,
    title: row.title,
    input: row.input,
    status: row.status as TaskStatus,
    groundTruth: row.ground_truth ?? null,
    createdAt: row.created_at,
  };
}

function mapAssignment(row: any): Assignment {
  return {
    id: row.id,
    companyId: row.company_id,
    taskId: row.task_id,
    workerId: row.worker_id,
    mode: row.mode as AllocationMode,
    trigger: row.trigger as AllocationTrigger,
    scores: (row.scores ?? []) as WorkerScore[],
    rationale: row.rationale,
    status: row.status as AssignmentStatus,
    output: row.output ?? null,
    costUSD: row.cost_usd === null || row.cost_usd === undefined ? null : Number(row.cost_usd),
    latencyMs: row.latency_ms === null || row.latency_ms === undefined ? null : Number(row.latency_ms),
    createdAt: row.created_at,
  };
}

function mapOutcome(row: any): Outcome {
  return {
    id: row.id,
    companyId: row.company_id,
    assignmentId: row.assignment_id,
    taskId: row.task_id,
    workerId: row.worker_id,
    taskTypeId: row.task_type_id,
    judgePass: Boolean(row.judge_pass),
    judgeDetail: row.judge_detail,
    confirmedPass:
      row.confirmed_pass === null || row.confirmed_pass === undefined
        ? null
        : Boolean(row.confirmed_pass),
    confirmedBy: row.confirmed_by ?? null,
    createdAt: row.created_at,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Create payload types (what a caller must supply; ids and created_at are DB
// generated, so they are omitted).
// ---------------------------------------------------------------------------

export type CompanyCreate = { name: string };

export type WorkerCreate = {
  companyId: string;
  kind: WorkerKind;
  name: string;
  provider?: string | null;
  model?: string | null;
  humanAxes: HumanAxes;
  aiAxes: AIAxes;
  costPerTaskUSD: number;
  typicalLatencySec: number;
  active?: boolean;
};

export type TaskTypeCreate = {
  companyId: string;
  name: string;
  description: string;
  requiredHumanAxes: HumanAxes;
  requiredAiAxes: AIAxes;
  reversibility: Reversibility;
  acceptanceCriteria: string;
};

export type TaskCreate = {
  companyId: string;
  taskTypeId: string;
  title: string;
  input: string;
  status?: TaskStatus;
  groundTruth?: unknown;
};

export type AssignmentCreate = {
  companyId: string;
  taskId: string;
  workerId: string;
  mode: AllocationMode;
  trigger: AllocationTrigger;
  scores: WorkerScore[];
  rationale: string;
  status: AssignmentStatus;
  output?: string | null;
  costUSD?: number | null;
  latencyMs?: number | null;
};

export type AssignmentPatch = {
  status?: AssignmentStatus;
  output?: string | null;
  costUSD?: number | null;
  latencyMs?: number | null;
};

export type OutcomeCreate = {
  companyId: string;
  assignmentId: string;
  taskId: string;
  workerId: string;
  taskTypeId: string;
  judgePass: boolean;
  judgeDetail: string;
  confirmedPass?: boolean | null;
  confirmedBy?: string | null;
};

export type OutcomePatch = {
  confirmedPass?: boolean | null;
  confirmedBy?: string | null;
};

// ---------------------------------------------------------------------------
// Repositories.
// ---------------------------------------------------------------------------

export const companyRepo = {
  async list(): Promise<Company[]> {
    const { data, error } = await getSupabaseClient()
      .from("company")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(`companyRepo.list: ${error.message}`);
    return (data ?? []).map(mapCompany);
  },

  async get(id: string): Promise<Company | null> {
    const { data, error } = await getSupabaseClient()
      .from("company")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`companyRepo.get: ${error.message}`);
    return data ? mapCompany(data) : null;
  },

  async create(input: CompanyCreate): Promise<Company> {
    const result = await getSupabaseClient()
      .from("company")
      .insert({ name: input.name })
      .select("*")
      .single();
    return mapCompany(unwrap(result, "companyRepo.create"));
  },
};

export const workerRepo = {
  async list(companyId: string, activeOnly = false): Promise<Worker[]> {
    let query = getSupabaseClient().from("worker").select("*").eq("company_id", companyId);
    if (activeOnly) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw new Error(`workerRepo.list: ${error.message}`);
    return (data ?? []).map(mapWorker);
  },

  async get(id: string): Promise<Worker | null> {
    const { data, error } = await getSupabaseClient()
      .from("worker")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`workerRepo.get: ${error.message}`);
    return data ? mapWorker(data) : null;
  },

  async create(input: WorkerCreate): Promise<Worker> {
    const result = await getSupabaseClient()
      .from("worker")
      .insert({
        company_id: input.companyId,
        kind: input.kind,
        name: input.name,
        provider: input.provider ?? null,
        model: input.model ?? null,
        human_axes: input.humanAxes,
        ai_axes: input.aiAxes,
        cost_per_task_usd: input.costPerTaskUSD,
        typical_latency_sec: input.typicalLatencySec,
        active: input.active ?? true,
      })
      .select("*")
      .single();
    return mapWorker(unwrap(result, "workerRepo.create"));
  },
};

export const taskTypeRepo = {
  async list(companyId: string): Promise<TaskType[]> {
    const { data, error } = await getSupabaseClient()
      .from("task_type")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw new Error(`taskTypeRepo.list: ${error.message}`);
    return (data ?? []).map(mapTaskType);
  },

  async get(id: string): Promise<TaskType | null> {
    const { data, error } = await getSupabaseClient()
      .from("task_type")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`taskTypeRepo.get: ${error.message}`);
    return data ? mapTaskType(data) : null;
  },

  async create(input: TaskTypeCreate): Promise<TaskType> {
    const result = await getSupabaseClient()
      .from("task_type")
      .insert({
        company_id: input.companyId,
        name: input.name,
        description: input.description,
        required_human_axes: input.requiredHumanAxes,
        required_ai_axes: input.requiredAiAxes,
        reversibility: input.reversibility,
        acceptance_criteria: input.acceptanceCriteria,
      })
      .select("*")
      .single();
    return mapTaskType(unwrap(result, "taskTypeRepo.create"));
  },
};

export const taskRepo = {
  async create(input: TaskCreate): Promise<Task> {
    const result = await getSupabaseClient()
      .from("task")
      .insert({
        company_id: input.companyId,
        task_type_id: input.taskTypeId,
        title: input.title,
        input: input.input,
        status: input.status ?? "pending",
        ground_truth: input.groundTruth ?? null,
      })
      .select("*")
      .single();
    return mapTask(unwrap(result, "taskRepo.create"));
  },

  async get(id: string): Promise<Task | null> {
    const { data, error } = await getSupabaseClient()
      .from("task")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`taskRepo.get: ${error.message}`);
    return data ? mapTask(data) : null;
  },

  async listByCompany(companyId: string): Promise<Task[]> {
    const { data, error } = await getSupabaseClient()
      .from("task")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw new Error(`taskRepo.listByCompany: ${error.message}`);
    return (data ?? []).map(mapTask);
  },

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    const result = await getSupabaseClient()
      .from("task")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();
    return mapTask(unwrap(result, "taskRepo.updateStatus"));
  },
};

export const assignmentRepo = {
  async create(input: AssignmentCreate): Promise<Assignment> {
    const result = await getSupabaseClient()
      .from("assignment")
      .insert({
        company_id: input.companyId,
        task_id: input.taskId,
        worker_id: input.workerId,
        mode: input.mode,
        trigger: input.trigger,
        scores: input.scores,
        rationale: input.rationale,
        status: input.status,
        output: input.output ?? null,
        cost_usd: input.costUSD ?? null,
        latency_ms: input.latencyMs ?? null,
      })
      .select("*")
      .single();
    return mapAssignment(unwrap(result, "assignmentRepo.create"));
  },

  async get(id: string): Promise<Assignment | null> {
    const { data, error } = await getSupabaseClient()
      .from("assignment")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`assignmentRepo.get: ${error.message}`);
    return data ? mapAssignment(data) : null;
  },

  async listByCompany(companyId: string, status?: AssignmentStatus): Promise<Assignment[]> {
    let query = getSupabaseClient()
      .from("assignment")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw new Error(`assignmentRepo.listByCompany: ${error.message}`);
    return (data ?? []).map(mapAssignment);
  },

  async update(id: string, patch: AssignmentPatch): Promise<Assignment> {
    // Translate only the provided fields to their columns, so a partial patch
    // never overwrites an untouched column with null.
    const columns: Record<string, unknown> = {};
    if (patch.status !== undefined) columns.status = patch.status;
    if (patch.output !== undefined) columns.output = patch.output;
    if (patch.costUSD !== undefined) columns.cost_usd = patch.costUSD;
    if (patch.latencyMs !== undefined) columns.latency_ms = patch.latencyMs;

    const result = await getSupabaseClient()
      .from("assignment")
      .update(columns)
      .eq("id", id)
      .select("*")
      .single();
    return mapAssignment(unwrap(result, "assignmentRepo.update"));
  },
};

export const outcomeRepo = {
  async create(input: OutcomeCreate): Promise<Outcome> {
    const result = await getSupabaseClient()
      .from("outcome")
      .insert({
        company_id: input.companyId,
        assignment_id: input.assignmentId,
        task_id: input.taskId,
        worker_id: input.workerId,
        task_type_id: input.taskTypeId,
        judge_pass: input.judgePass,
        judge_detail: input.judgeDetail,
        confirmed_pass: input.confirmedPass ?? null,
        confirmed_by: input.confirmedBy ?? null,
      })
      .select("*")
      .single();
    return mapOutcome(unwrap(result, "outcomeRepo.create"));
  },

  async get(id: string): Promise<Outcome | null> {
    const { data, error } = await getSupabaseClient()
      .from("outcome")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`outcomeRepo.get: ${error.message}`);
    return data ? mapOutcome(data) : null;
  },

  async update(id: string, patch: OutcomePatch): Promise<Outcome> {
    const columns: Record<string, unknown> = {};
    if (patch.confirmedPass !== undefined) columns.confirmed_pass = patch.confirmedPass;
    if (patch.confirmedBy !== undefined) columns.confirmed_by = patch.confirmedBy;

    const result = await getSupabaseClient()
      .from("outcome")
      .update(columns)
      .eq("id", id)
      .select("*")
      .single();
    return mapOutcome(unwrap(result, "outcomeRepo.update"));
  },

  async listByCompany(companyId: string): Promise<Outcome[]> {
    const { data, error } = await getSupabaseClient()
      .from("outcome")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw new Error(`outcomeRepo.listByCompany: ${error.message}`);
    return (data ?? []).map(mapOutcome);
  },
};

/** Convenience bundle so callers can `import { repos }` and reach every table. */
export const repos = {
  company: companyRepo,
  worker: workerRepo,
  taskType: taskTypeRepo,
  task: taskRepo,
  assignment: assignmentRepo,
  outcome: outcomeRepo,
};
