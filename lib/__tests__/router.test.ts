import { describe, expect, it } from "vitest";

import { newPosterior } from "../posterior";
import { route, scoreWorkerWith } from "../router";
import type { Task, Worker } from "../types";

// The original engine routed against a static worker registry; the
// generalized router takes a DYNAMIC worker list, so this test constructs its
// own explicit set. These are the same four workers (identical axis profiles,
// costs, and latencies) the original registry defined, so the asserted
// routing behaviors are identical to the original suite.
const WORKERS: Worker[] = [
  {
    id: "human_amit",
    kind: "human",
    name: "Operator",
    humanAxes: {
      nuance: 0.9,
      crossDomain: 0.85,
      unbiasedPushback: 0.88,
      emotionalStakes: 0.92,
      trust: 0.95,
    },
    aiAxes: {
      multiStepDecisioning: 0.5,
      contextCapacity: 0.4,
      salienceWeighing: 0.6,
    },
    costPerTaskUSD: 8.0,
    typicalLatencySec: 600,
  },
  {
    id: "agent_cheap",
    kind: "agent",
    name: "Scout",
    provider: "openai",
    modelId: "gpt-4o-mini",
    humanAxes: {
      nuance: 0.2,
      crossDomain: 0.25,
      unbiasedPushback: 0.05,
      emotionalStakes: 0.15,
      trust: 0.15,
    },
    aiAxes: {
      multiStepDecisioning: 0.55,
      contextCapacity: 0.6,
      salienceWeighing: 0.5,
    },
    costPerTaskUSD: 0.02,
    typicalLatencySec: 15,
  },
  {
    id: "agent_mid",
    kind: "agent",
    name: "Analyst",
    provider: "openai",
    modelId: "gpt-4o",
    humanAxes: {
      nuance: 0.35,
      crossDomain: 0.4,
      unbiasedPushback: 0.1,
      emotionalStakes: 0.25,
      trust: 0.2,
    },
    aiAxes: {
      multiStepDecisioning: 0.75,
      contextCapacity: 0.8,
      salienceWeighing: 0.75,
    },
    costPerTaskUSD: 0.08,
    typicalLatencySec: 25,
  },
  {
    id: "agent_strong",
    kind: "agent",
    name: "Expert",
    provider: "openai",
    modelId: "gpt-5",
    humanAxes: {
      nuance: 0.5,
      crossDomain: 0.55,
      unbiasedPushback: 0.15,
      emotionalStakes: 0.35,
      trust: 0.25,
    },
    aiAxes: {
      multiStepDecisioning: 0.9,
      contextCapacity: 0.9,
      salienceWeighing: 0.9,
    },
    costPerTaskUSD: 0.4,
    typicalLatencySec: 40,
  },
];

// Cold start: every (worker, taskType) reputation is Beta(1,1). This mirrors
// the original test's empty posteriors map, which fell back to newPosterior()
// on every lookup.
const coldReputation = () => newPosterior();

/** Build a full Task from overrides, so each test only states what matters. */
function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "task_default",
    type: "invoice_extraction",
    title: "Default task",
    input: "",
    difficulty: "medium",
    reversibility: "reversible",
    humanAxes: {
      nuance: 0.1,
      crossDomain: 0.1,
      unbiasedPushback: 0.1,
      emotionalStakes: 0.1,
      trust: 0.1,
    },
    aiAxes: {
      multiStepDecisioning: 0.5,
      contextCapacity: 0.5,
      salienceWeighing: 0.5,
    },
    groundTruth: null,
    ...overrides,
  };
}

describe("axisMatch / scoreWorkerWith", () => {
  it("ranks agent_cheap above agent_mid on a hard extraction task at cold start with injected weights", () => {
    const task = makeTask({
      id: "task_hard_extraction",
      title: "Hard extraction task",
      difficulty: "hard",
      aiAxes: {
        multiStepDecisioning: 0.8,
        contextCapacity: 0.75,
        salienceWeighing: 0.7,
      },
    });

    const weights = { axis: 0.15, cost: 0.5, latency: 0.05, reliability: 0.3 };
    const coldStart = newPosterior(); // Beta(1,1) for every worker

    const cheap = WORKERS.find((w) => w.id === "agent_cheap")!;
    const mid = WORKERS.find((w) => w.id === "agent_mid")!;

    const cheapResult = scoreWorkerWith(weights, task, cheap, coldStart, WORKERS);
    const midResult = scoreWorkerWith(weights, task, mid, coldStart, WORKERS);

    expect(cheapResult.score).toBeGreaterThan(midResult.score);
  });
});

describe("route mode triggers", () => {
  it("fires the capability trigger when both axis means clear the threshold", () => {
    const task = makeTask({
      id: "task_capability",
      title: "High-stakes, high-throughput task",
      reversibility: "reversible",
      humanAxes: {
        nuance: 0.8,
        crossDomain: 0.8,
        unbiasedPushback: 0.8,
        emotionalStakes: 0.8,
        trust: 0.8,
      },
      aiAxes: {
        multiStepDecisioning: 0.8,
        contextCapacity: 0.8,
        salienceWeighing: 0.8,
      },
    });

    const allocation = route(task, WORKERS, coldReputation);

    expect(allocation.mode).toBe("agent_proposes_human_approves");
    expect(allocation.trigger).toBe("capability");
  });

  it("fires the risk trigger when an irreversible task's top-ranked worker is an agent", () => {
    const task = makeTask({
      id: "task_risk",
      title: "Irreversible, low human-axis task",
      reversibility: "irreversible",
      humanAxes: {
        nuance: 0.1,
        crossDomain: 0.1,
        unbiasedPushback: 0.1,
        emotionalStakes: 0.1,
        trust: 0.1,
      },
      aiAxes: {
        multiStepDecisioning: 0.8,
        contextCapacity: 0.8,
        salienceWeighing: 0.8,
      },
    });

    const allocation = route(task, WORKERS, coldReputation);

    const topWorker = WORKERS.find((w) => w.id === allocation.scores[0].workerId)!;
    expect(topWorker.kind).toBe("agent");
    expect(allocation.trigger).toBe("risk");
    expect(allocation.mode).toBe("agent_proposes_human_approves");
  });

  it("routes an easy, reversible extraction task to agent_solo with no trigger", () => {
    const task = makeTask({
      id: "task_easy",
      type: "invoice_extraction",
      title: "Easy reversible extraction task",
      difficulty: "easy",
      reversibility: "reversible",
      humanAxes: {
        nuance: 0.1,
        crossDomain: 0.1,
        unbiasedPushback: 0.1,
        emotionalStakes: 0.1,
        trust: 0.1,
      },
      aiAxes: {
        multiStepDecisioning: 0.4,
        contextCapacity: 0.4,
        salienceWeighing: 0.4,
      },
    });

    const allocation = route(task, WORKERS, coldReputation);

    expect(allocation.mode).toBe("agent_solo");
    expect(allocation.trigger).toBe("none");

    // Rationale is non-empty and names the winning worker.
    const winner = WORKERS.find((w) => w.id === allocation.workerId)!;
    expect(allocation.rationale.length).toBeGreaterThan(0);
    expect(allocation.rationale).toContain(winner.name);
  });
});

describe("judgment trigger (calibration amendment, 2026-07-11)", () => {
  it("routes a high-human / low-AI task to the human by rule, not by score", () => {
    const task = makeTask({
      id: "task_judgment",
      type: "email_triage",
      title: "Renegotiate contract terms with long-standing client",
      humanAxes: {
        nuance: 0.9,
        crossDomain: 0.6,
        unbiasedPushback: 0.95,
        emotionalStakes: 0.9,
        trust: 0.9,
      },
      aiAxes: {
        multiStepDecisioning: 0.3,
        contextCapacity: 0.4,
        salienceWeighing: 0.3,
      },
    });
    const allocation = route(task, WORKERS, coldReputation);
    expect(allocation.mode).toBe("human_solo");
    expect(allocation.trigger).toBe("judgment");
    expect(allocation.workerId).toBe("human_amit");
    expect(allocation.rationale).toContain("by rule");
  });

  it("does not fire on low-human tasks (falls through to score-based routing)", () => {
    const task = makeTask({ id: "task_plain_extraction" });
    const allocation = route(task, WORKERS, coldReputation);
    expect(allocation.trigger).not.toBe("judgment");
    expect(allocation.mode).toBe("agent_solo");
  });
});

describe("all-human pool guards (findings #3, #12)", () => {
  const HUMANS_ONLY: Worker[] = WORKERS.filter((w) => w.kind === "human");

  it("downgrades a capability-triggered task to human_solo when no agent exists (finding #3)", () => {
    const task = makeTask({
      id: "task_capability_no_agent",
      reversibility: "reversible",
      humanAxes: {
        nuance: 0.8,
        crossDomain: 0.8,
        unbiasedPushback: 0.8,
        emotionalStakes: 0.8,
        trust: 0.8,
      },
      aiAxes: { multiStepDecisioning: 0.8, contextCapacity: 0.8, salienceWeighing: 0.8 },
    });

    const allocation = route(task, HUMANS_ONLY, coldReputation);

    // Must NOT emit an unexecutable agent_proposes_human_approves pointing at a human.
    expect(allocation.mode).toBe("human_solo");
    expect(allocation.mode).not.toBe("agent_proposes_human_approves");
    const chosen = HUMANS_ONLY.find((w) => w.id === allocation.workerId)!;
    expect(chosen.kind).toBe("human");
  });

  it("explains an irreversible solo-human allocation is safe because a human executes it (finding #12)", () => {
    const task = makeTask({
      id: "task_irreversible_all_human",
      reversibility: "irreversible",
      humanAxes: {
        nuance: 0.1,
        crossDomain: 0.1,
        unbiasedPushback: 0.1,
        emotionalStakes: 0.1,
        trust: 0.1,
      },
      aiAxes: { multiStepDecisioning: 0.2, contextCapacity: 0.2, salienceWeighing: 0.2 },
    });

    const allocation = route(task, HUMANS_ONLY, coldReputation);

    expect(allocation.mode).toBe("human_solo");
    expect(allocation.rationale.toLowerCase()).toContain("human executes it directly");
  });
});

describe("single-candidate rationale (finding #9)", () => {
  it("omits the comparative 'ranked ahead of <same>' clause when there is one candidate", () => {
    const solo: Worker[] = [WORKERS.find((w) => w.id === "agent_cheap")!];
    const task = makeTask({ id: "task_single_candidate" });

    const allocation = route(task, solo, coldReputation);

    expect(allocation.rationale.length).toBeGreaterThan(0);
    expect(allocation.rationale).not.toContain("ranked ahead of");
    // Self-comparison text must never appear.
    expect(allocation.rationale).not.toContain("Scout (0.");
  });
});
