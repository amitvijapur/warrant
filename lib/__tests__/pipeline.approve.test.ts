// approveAndExecute guard (finding #5) + approval audit event (finding #11).
// The DB repos, the gate, the judge, the substrate, and the evidence sidecar
// are all mocked, so these tests exercise only approveAndExecute's own control
// flow — no Supabase, no model calls.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  assignmentGet: vi.fn(),
  assignmentUpdate: vi.fn(),
  workerGet: vi.fn(),
  taskGet: vi.fn(),
  taskTypeGet: vi.fn(),
  taskUpdateStatus: vi.fn(),
  outcomeCreate: vi.fn(),
  mint: vi.fn(),
  execIrr: vi.fn(),
  judge: vi.fn(),
  evidence: vi.fn(),
  buildPrompt: vi.fn(),
}));

vi.mock("../repos", () => ({
  repos: {
    assignment: { get: h.assignmentGet, update: h.assignmentUpdate },
    worker: { get: h.workerGet },
    task: { get: h.taskGet, updateStatus: h.taskUpdateStatus },
    taskType: { get: h.taskTypeGet },
    outcome: { create: h.outcomeCreate },
  },
  outcomeRepo: { listByCompany: vi.fn(async () => []) },
}));
vi.mock("../gate", () => ({ mintApprovalToken: h.mint, executeIrreversible: h.execIrr }));
vi.mock("../judge", () => ({ judgeOutput: h.judge }));
vi.mock("../evidence", () => ({ appendEvidence: h.evidence }));
vi.mock("../substrate", () => ({ buildAgentPrompt: h.buildPrompt, executeTask: vi.fn() }));

import { approveAndExecute } from "../pipeline";

const AGENT = { id: "agent_1", kind: "agent", name: "Scout", model: "gpt-4o-mini", provider: "openai" };
const TASK = { id: "task_1", companyId: "co_1", taskTypeId: "tt_1", title: "T", input: "in", groundTruth: null };
const TASK_TYPE = {
  id: "tt_1",
  companyId: "co_1",
  name: "TT",
  description: "d",
  acceptanceCriteria: "ac",
  requiredHumanAxes: {},
  requiredAiAxes: {},
};

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assign_1",
    companyId: "co_1",
    taskId: "task_1",
    workerId: "agent_1",
    mode: "agent_proposes_human_approves",
    trigger: "risk",
    scores: [],
    rationale: "r",
    status: "awaiting_approval",
    output: "agent output",
    costUSD: null,
    latencyMs: null,
    createdAt: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.workerGet.mockResolvedValue({ ...AGENT });
  h.taskGet.mockResolvedValue({ ...TASK });
  h.taskTypeGet.mockResolvedValue({ ...TASK_TYPE, reversibility: "irreversible" });
  h.buildPrompt.mockReturnValue({ system: "s", user: "u", maxTokens: 800 });
  h.mint.mockReturnValue({ __brand: "HumanApproval", taskId: "task_1", workerId: "agent_1", approvedBy: "Amit", ts: "t", nonce: "nonce_xyz", hmac: "hh" });
  h.execIrr.mockResolvedValue({ output: "agent output", latencyMs: 5, costUSD: 0.01 });
  h.assignmentUpdate.mockResolvedValue(assignment({ status: "completed" }));
  h.taskUpdateStatus.mockResolvedValue({ ...TASK, status: "completed" });
  h.judge.mockResolvedValue({ pass: true, detail: "ok" });
  h.outcomeCreate.mockResolvedValue({ id: "out_1", judgePass: true });
  h.evidence.mockResolvedValue(undefined);
});

describe("approveAndExecute guard (finding #5)", () => {
  it("throws when the assignment is not awaiting approval, and never runs the gate", async () => {
    h.assignmentGet.mockResolvedValue(assignment({ status: "running" }));

    await expect(approveAndExecute("assign_1", "Amit")).rejects.toThrow(/not awaiting approval/);
    expect(h.mint).not.toHaveBeenCalled();
    expect(h.execIrr).not.toHaveBeenCalled();
  });

  it("throws when the task type is reversible, and never runs the gate", async () => {
    h.assignmentGet.mockResolvedValue(assignment());
    h.taskTypeGet.mockResolvedValue({ ...TASK_TYPE, reversibility: "reversible" });

    await expect(approveAndExecute("assign_1", "Amit")).rejects.toThrow(/reversible/);
    expect(h.mint).not.toHaveBeenCalled();
    expect(h.execIrr).not.toHaveBeenCalled();
  });
});

describe("approveAndExecute approval audit event (finding #11)", () => {
  it("persists an approval evidence event before execution, bound to the worker", async () => {
    h.assignmentGet.mockResolvedValue(assignment());

    await approveAndExecute("assign_1", "Amit");

    // Token minted bound to (taskId, approvedBy, workerId) — finding #1.
    expect(h.mint).toHaveBeenCalledWith("task_1", "Amit", "agent_1");

    // An approval event was recorded with the correlating nonce.
    expect(h.evidence).toHaveBeenCalledTimes(1);
    expect(h.evidence).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "approval",
        taskId: "task_1",
        assignmentId: "assign_1",
        workerId: "agent_1",
        approvedBy: "Amit",
        nonce: "nonce_xyz",
      }),
    );

    // Recorded BEFORE the irreversible execution ran.
    expect(h.evidence.mock.invocationCallOrder[0]).toBeLessThan(
      h.execIrr.mock.invocationCallOrder[0],
    );
  });
});
