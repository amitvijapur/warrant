import { describe, expect, it } from "vitest";

import { foldOutcomes, reputationForFrom, verdictOf } from "../reputation";

// The fields foldOutcomes reads, plus the assignmentId/createdAt it dedupes on.
type OutcomeFold = {
  assignmentId: string;
  workerId: string;
  taskTypeId: string;
  judgePass: boolean;
  confirmedPass: boolean | null;
  createdAt: string;
};

// Each outcome() gets a fresh assignmentId + monotonically increasing
// createdAt by default, so the existing "counted once each" assertions hold;
// tests exercising de-duplication pass an explicit assignmentId.
let seq = 0;
function outcome(
  workerId: string,
  taskTypeId: string,
  judgePass: boolean,
  confirmedPass: boolean | null = null,
  assignmentId?: string,
  createdAt?: string,
): OutcomeFold {
  seq += 1;
  return {
    assignmentId: assignmentId ?? `a${seq}`,
    workerId,
    taskTypeId,
    judgePass,
    confirmedPass,
    createdAt: createdAt ?? new Date(seq * 1000).toISOString(),
  };
}

describe("verdictOf", () => {
  it("uses judgePass when there is no human confirmation", () => {
    expect(verdictOf({ judgePass: true, confirmedPass: null })).toBe(true);
    expect(verdictOf({ judgePass: false, confirmedPass: null })).toBe(false);
  });

  it("lets a human confirmation override the judge in both directions", () => {
    expect(verdictOf({ judgePass: false, confirmedPass: true })).toBe(true);
    expect(verdictOf({ judgePass: true, confirmedPass: false })).toBe(false);
  });
});

describe("foldOutcomes", () => {
  it("folds successes and failures into Beta(1 + successes, 1 + failures)", () => {
    const outcomes = [
      outcome("w1", "tA", true),
      outcome("w1", "tA", true),
      outcome("w1", "tA", true),
      outcome("w1", "tA", false),
    ];
    const map = foldOutcomes(outcomes);
    expect(map.get("w1:tA")).toEqual({ alpha: 4, beta: 2 });
  });

  it("keeps distinct (worker, taskType) buckets independent", () => {
    const outcomes = [
      outcome("w1", "tA", true),
      outcome("w1", "tB", false),
      outcome("w2", "tA", false),
      outcome("w2", "tA", false),
    ];
    const map = foldOutcomes(outcomes);
    expect(map.get("w1:tA")).toEqual({ alpha: 2, beta: 1 });
    expect(map.get("w1:tB")).toEqual({ alpha: 1, beta: 2 });
    expect(map.get("w2:tA")).toEqual({ alpha: 1, beta: 3 });
  });

  it("counts the confirmed verdict, not the judge verdict, when a human confirmed", () => {
    const outcomes = [
      outcome("w1", "tA", true, false), // judge passed, human failed it -> failure
      outcome("w1", "tA", false, true), // judge failed, human passed it -> success
    ];
    const map = foldOutcomes(outcomes);
    expect(map.get("w1:tA")).toEqual({ alpha: 2, beta: 2 });
  });

  it("produces an empty map for no outcomes", () => {
    expect(foldOutcomes([]).size).toBe(0);
  });

  it("de-duplicates repeated rows for one assignment, counting it once (finding #10)", () => {
    // A flaky/retried judge wrote the same assignment's outcome twice.
    const outcomes = [
      outcome("w1", "tA", true, null, "assign_1", "2026-07-12T00:00:00.000Z"),
      outcome("w1", "tA", true, null, "assign_1", "2026-07-12T00:00:00.000Z"),
    ];
    // Without dedup this would be Beta(3,1); counted once it is Beta(2,1).
    expect(foldOutcomes(outcomes).get("w1:tA")).toEqual({ alpha: 2, beta: 1 });
  });

  it("keeps the latest verdict when an assignment's outcome was corrected (finding #10)", () => {
    // The later createdAt wins regardless of input order.
    const outcomes = [
      outcome("w1", "tA", false, null, "assign_1", "2026-07-12T09:00:00.000Z"), // corrected verdict (later)
      outcome("w1", "tA", true, null, "assign_1", "2026-07-12T08:00:00.000Z"), // original (earlier)
    ];
    // Latest is a failure -> Beta(1, 2), not Beta(2, 1).
    expect(foldOutcomes(outcomes).get("w1:tA")).toEqual({ alpha: 1, beta: 2 });
  });
});

describe("reputationForFrom", () => {
  it("returns the folded posterior for a known (worker, taskType)", () => {
    const map = foldOutcomes([outcome("w1", "tA", true), outcome("w1", "tA", false)]);
    const lookup = reputationForFrom(map);
    expect(lookup("w1", "tA")).toEqual({ alpha: 2, beta: 2 });
  });

  it("falls back to the Beta(1,1) cold-start prior for an unknown pair", () => {
    const lookup = reputationForFrom(foldOutcomes([]));
    expect(lookup("nobody", "nothing")).toEqual({ alpha: 1, beta: 1 });
  });
});
