// Browser-side API client for the warrant operator console.
//
// Every page is a client component that talks to the backend only through the
// functions below. Each wraps a same-origin `/api` call, parses the JSON, and
// throws `new Error(body.error)` on a non-ok response so callers can render the
// backend's own message. The backend (app/api/**, lib/**) is complete and is
// never modified — this file only consumes its contract.

import type {
  Assignment,
  Company,
  Outcome,
  Task,
  TaskType,
  Worker,
} from "@/lib/db-types";
import type { Allocation } from "@/lib/types";

/** The classifier's read on a freshly submitted task (see POST /api/tasks). */
export type Classification = {
  taskTypeId: string;
  reversibility: "reversible" | "irreversible";
  confidence: number;
  reasoning: string;
};

/** One (worker, task type) reliability posterior (see GET …/reputation). */
export type ReputationRow = {
  workerId: string;
  taskTypeId: string;
  alpha: number;
  beta: number;
  mean: number;
};

/** A worker the designer proposes for a company (see /api/design/propose). */
export type ProposedWorker = {
  kind: "agent" | "human";
  name: string;
  provider: string;
  model: string;
  costPerTaskUSD: number;
  typicalLatencySec: number;
  humanAxes: Record<string, number>;
  aiAxes: Record<string, number>;
  rationale?: string;
};

/** A task type the designer proposes for a company. */
export type ProposedTaskType = {
  name: string;
  description: string;
  reversibility: "reversible" | "irreversible";
  requiredHumanAxes: Record<string, number>;
  requiredAiAxes: Record<string, number>;
  acceptanceCriteria: string;
};

export type DesignProposal = { workers: ProposedWorker[]; taskTypes: ProposedTaskType[] };

export type SubmitTaskResult = { task: Task; classification: Classification };
export type RouteResult = { assignment: Assignment; allocation: Allocation };
export type OutputResult = { assignment: Assignment; outcome: Outcome };

/** Execute branches on the router's mode + the task's reversibility. */
export type ExecuteResult =
  | { status: "completed"; assignment: Assignment; outcome: Outcome }
  | { status: "gate_required"; assignment: Assignment }
  | { status: "human_work_item"; assignment: Assignment };

/** Shared fetch wrapper: parse JSON, surface `{ error }` as a thrown Error. */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.body
        ? { "content-type": "application/json", ...init?.headers }
        : init?.headers,
    });
  } catch {
    throw new Error("Network error — the console could not reach the server.");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // fall through to the status-based message below
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

const json = (data: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(data),
});

export const api = {
  // ── Reads ──────────────────────────────────────────────────────────────
  companies: () => request<Company[]>("/api/companies"),

  workers: (companyId: string) =>
    request<Worker[]>(`/api/companies/${companyId}/workers`),

  taskTypes: (companyId: string) =>
    request<TaskType[]>(`/api/companies/${companyId}/task-types`),

  tasks: (companyId: string) =>
    request<Task[]>(`/api/companies/${companyId}/tasks`),

  assignments: (companyId: string, status?: string) =>
    request<Assignment[]>(
      `/api/companies/${companyId}/assignments${status ? `?status=${status}` : ""}`,
    ),

  reputation: (companyId: string) =>
    request<ReputationRow[]>(`/api/companies/${companyId}/reputation`),

  // ── Writes — the routing loop ────────────────────────────────────────────
  submitTask: (companyId: string, title: string, input: string) =>
    request<SubmitTaskResult>("/api/tasks", json({ companyId, title, input })),

  route: (taskId: string) =>
    request<RouteResult>(`/api/tasks/${taskId}/route`, { method: "POST" }),

  execute: (assignmentId: string) =>
    request<ExecuteResult>(`/api/assignments/${assignmentId}/execute`, {
      method: "POST",
    }),

  submitOutput: (assignmentId: string, output: string) =>
    request<OutputResult>(
      `/api/assignments/${assignmentId}/output`,
      json({ output }),
    ),

  approve: (assignmentId: string, approvedBy: string) =>
    request<OutputResult>(
      `/api/assignments/${assignmentId}/approve`,
      json({ approvedBy }),
    ),

  confirm: (outcomeId: string, confirmedPass: boolean, confirmedBy: string) =>
    request<Outcome>(
      `/api/outcomes/${outcomeId}/confirm`,
      json({ confirmedPass, confirmedBy }),
    ),

  // ── Design: propose a tailored workforce, then persist it ─────────────────
  proposeDesign: (name: string, needs: string) =>
    request<DesignProposal>("/api/design/propose", json({ name, needs })),

  applyDesign: (name: string, workers: ProposedWorker[], taskTypes: ProposedTaskType[]) =>
    request<{ company: Company }>("/api/design/apply", json({ name, workers, taskTypes })),
};
