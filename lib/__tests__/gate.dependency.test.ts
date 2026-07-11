// AC-P2b: dependency boundary test. mintApprovalToken (lib/gate.ts) may ONLY
// be imported by the approval API route — if the router or the execution
// substrate could reach it (or read the signing secret directly), the
// Authority Gate could be forged/bypassed from inside the automated pipeline.
// This test reads the raw SOURCE TEXT of the frozen engine files (not their
// exports/behavior) and fails if either forbidden string appears.
//
// Adapted from the original three-file scan: this repo ports the engine only,
// so scripts/run-batch.ts does not exist here and the invariant is enforced
// over the two frozen engine files that do — router.ts and substrate.ts.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

const FROZEN_FILES = [
  join(TEST_DIR, "..", "router.ts"),
  join(TEST_DIR, "..", "substrate.ts"),
];

const FORBIDDEN_TOKENS = ["mintApprovalToken", "APPROVAL_SIGNING_SECRET"];

describe("Authority Gate dependency boundary (AC-P2b)", () => {
  it.each(FROZEN_FILES)("%s never references the gate's minting internals", (filePath) => {
    const source = readFileSync(filePath, "utf8");
    for (const token of FORBIDDEN_TOKENS) {
      expect(source).not.toContain(token);
    }
  });
});
