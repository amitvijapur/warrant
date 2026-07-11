// Evidence sidecar (finding #11): appendEvidence fans out to registered sinks
// and is best-effort — a throwing sink never propagates, so it can never fail
// the operation it records.

import { afterEach, describe, expect, it, vi } from "vitest";

import { appendEvidence, clearEvidenceSinks, registerEvidenceSink } from "../evidence";
import type { EvidenceEvent } from "../types";

const EVENT: EvidenceEvent = { ts: "2026-07-12T00:00:00.000Z", type: "approval", taskId: "t1" };

afterEach(() => {
  clearEvidenceSinks();
});

describe("appendEvidence", () => {
  it("delivers the event to every registered sink", async () => {
    const a = vi.fn();
    const b = vi.fn();
    registerEvidenceSink(a);
    registerEvidenceSink(b);

    await appendEvidence(EVENT);

    expect(a).toHaveBeenCalledWith(EVENT);
    expect(b).toHaveBeenCalledWith(EVENT);
  });

  it("is a no-op with no sink registered", async () => {
    await expect(appendEvidence(EVENT)).resolves.toBeUndefined();
  });

  it("swallows a throwing sink and still reaches the others (best-effort)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const throwing = vi.fn(() => {
      throw new Error("sink down");
    });
    const healthy = vi.fn();
    registerEvidenceSink(throwing);
    registerEvidenceSink(healthy);

    await expect(appendEvidence(EVENT)).resolves.toBeUndefined();
    expect(healthy).toHaveBeenCalledWith(EVENT);
    warn.mockRestore();
  });
});
