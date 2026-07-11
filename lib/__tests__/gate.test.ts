// AC-P2a: runtime enforcement of the Authority Gate. Does NOT call any model
// API — executeTask (lib/substrate.ts) is mocked so these tests exercise only
// the gate's own verification logic.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../substrate", () => ({
  executeTask: vi.fn(async () => ({ output: "mock output", latencyMs: 1 })),
}));

import { executeTask } from "../substrate";
import {
  executeIrreversible,
  executeReversible,
  mintApprovalToken,
  verifyToken,
} from "../gate";
import type { ApprovalToken } from "../gate";
import type { Task, Worker } from "../types";

const TEST_SECRET = "test-signing-secret-not-real";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_default",
    type: "invoice_extraction",
    title: "Default task",
    input: "",
    difficulty: "medium",
    reversibility: "reversible",
    humanAxes: { nuance: 0.1, crossDomain: 0.1, unbiasedPushback: 0.1, emotionalStakes: 0.1, trust: 0.1 },
    aiAxes: { multiStepDecisioning: 0.5, contextCapacity: 0.5, salienceWeighing: 0.5 },
    groundTruth: null,
    ...overrides,
  };
}

function makeWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: "agent_test",
    kind: "agent",
    name: "Test Agent",
    provider: "openai",
    modelId: "gpt-4o-mini",
    humanAxes: { nuance: 0.2, crossDomain: 0.2, unbiasedPushback: 0.1, emotionalStakes: 0.1, trust: 0.1 },
    aiAxes: { multiStepDecisioning: 0.5, contextCapacity: 0.5, salienceWeighing: 0.5 },
    costPerTaskUSD: 0.02,
    typicalLatencySec: 10,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("APPROVAL_SIGNING_SECRET", TEST_SECRET);
  vi.mocked(executeTask).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mintApprovalToken / verifyToken", () => {
  it("mints a token that verifies", () => {
    const token = mintApprovalToken("task_1", "amit", "agent_1");
    expect(verifyToken(token)).toBe(true);
  });

  it("rejects a token with a tampered hmac", () => {
    const token = mintApprovalToken("task_1", "amit", "agent_1");
    const tampered: ApprovalToken = { ...token, hmac: "0".repeat(token.hmac.length) };
    expect(verifyToken(tampered)).toBe(false);
  });

  it("rejects a token whose workerId was swapped after minting (workerId is HMAC-bound)", () => {
    const token = mintApprovalToken("task_1", "amit", "agent_1");
    const swapped: ApprovalToken = { ...token, workerId: "agent_evil" };
    expect(verifyToken(swapped)).toBe(false);
  });

  it("throws a clear error when the signing secret is unset", () => {
    vi.unstubAllEnvs();
    delete process.env.APPROVAL_SIGNING_SECRET;
    expect(() => mintApprovalToken("task_x", "amit", "agent_1")).toThrow(/APPROVAL_SIGNING_SECRET/);
  });
});

describe("executeIrreversible (AC-P2a)", () => {
  it("throws on a token with a tampered hmac, and never calls executeTask", async () => {
    const task = makeTask({ id: "task_irr", reversibility: "irreversible" });
    const worker = makeWorker();
    const token = mintApprovalToken(task.id, "amit", worker.id);
    const tampered: ApprovalToken = { ...token, hmac: "0".repeat(token.hmac.length) };

    await expect(executeIrreversible(task, worker, tampered)).rejects.toThrow();
    expect(executeTask).not.toHaveBeenCalled();
  });

  it("throws on a missing or malformed token, and never calls executeTask", async () => {
    const task = makeTask({ id: "task_irr_malformed", reversibility: "irreversible" });
    const worker = makeWorker();

    await expect(executeIrreversible(task, worker, undefined as any)).rejects.toThrow();
    await expect(executeIrreversible(task, worker, { foo: "bar" } as any)).rejects.toThrow();
    await expect(executeIrreversible(task, worker, null as any)).rejects.toThrow();
    expect(executeTask).not.toHaveBeenCalled();
  });

  it("calls executeTask only after verification passes, with the exact task and worker", async () => {
    const task = makeTask({ id: "task_irr_ok", reversibility: "irreversible" });
    const worker = makeWorker();
    const token = mintApprovalToken(task.id, "amit", worker.id);

    const result = await executeIrreversible(task, worker, token);

    expect(executeTask).toHaveBeenCalledTimes(1);
    expect(executeTask).toHaveBeenCalledWith(task, worker);
    expect(result).toEqual({ output: "mock output", latencyMs: 1 });
  });
});

// AC-P2a hardening: a verified token is bound to its (task, worker), is
// single-use, and expires — closing the cross-task approval hole and the
// replay window at the core gate (review findings #1 and #2).
describe("executeIrreversible token binding + anti-replay (findings #1, #2)", () => {
  it("rejects a valid token minted for a DIFFERENT task (finding #1: task binding)", async () => {
    const taskA = makeTask({ id: "task_A", reversibility: "irreversible" });
    const taskB = makeTask({ id: "task_B", reversibility: "irreversible" });
    const worker = makeWorker();
    // A genuine, HMAC-valid approval for task A.
    const tokenForA = mintApprovalToken(taskA.id, "amit", worker.id);

    await expect(executeIrreversible(taskB, worker, tokenForA)).rejects.toThrow(/task/);
    expect(executeTask).not.toHaveBeenCalled();
  });

  it("rejects a valid token minted for a DIFFERENT worker (finding #1: worker binding)", async () => {
    const task = makeTask({ id: "task_wb", reversibility: "irreversible" });
    const worker = makeWorker({ id: "agent_real" });
    const tokenForOther = mintApprovalToken(task.id, "amit", "agent_other");

    await expect(executeIrreversible(task, worker, tokenForOther)).rejects.toThrow(/worker/);
    expect(executeTask).not.toHaveBeenCalled();
  });

  it("rejects a second presentation of the same token (finding #2: single-use nonce)", async () => {
    const task = makeTask({ id: "task_replay", reversibility: "irreversible" });
    const worker = makeWorker();
    const token = mintApprovalToken(task.id, "amit", worker.id);

    // First use succeeds and consumes the nonce.
    await executeIrreversible(task, worker, token);
    expect(executeTask).toHaveBeenCalledTimes(1);

    // Replaying the very same token is rejected without re-executing.
    await expect(executeIrreversible(task, worker, token)).rejects.toThrow(/already been used/);
    expect(executeTask).toHaveBeenCalledTimes(1);
  });

  it("rejects an expired token (finding #2: freshness window)", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-12T00:00:00.000Z"));
      const task = makeTask({ id: "task_expired", reversibility: "irreversible" });
      const worker = makeWorker();
      const token = mintApprovalToken(task.id, "amit", worker.id);

      // Advance 11 minutes — past the 10-minute freshness window.
      vi.advanceTimersByTime(11 * 60 * 1000);

      await expect(executeIrreversible(task, worker, token)).rejects.toThrow(/expired/);
      expect(executeTask).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("executeReversible (AC-P2a)", () => {
  it("throws on an irreversible task and never calls executeTask", async () => {
    const task = makeTask({ id: "task_rev_blocked", reversibility: "irreversible" });
    const worker = makeWorker();

    await expect(executeReversible(task, worker)).rejects.toThrow();
    expect(executeTask).not.toHaveBeenCalled();
  });

  it("calls executeTask for a reversible task", async () => {
    const task = makeTask({ id: "task_rev_ok", reversibility: "reversible" });
    const worker = makeWorker();

    const result = await executeReversible(task, worker);

    expect(executeTask).toHaveBeenCalledTimes(1);
    expect(executeTask).toHaveBeenCalledWith(task, worker);
    expect(result).toEqual({ output: "mock output", latencyMs: 1 });
  });
});
