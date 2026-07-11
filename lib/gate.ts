// Authority Gate: the flagship invariant. An irreversible task's execution
// may reach the substrate ONLY through executeIrreversible, and
// executeIrreversible only proceeds once it has verified a signed
// ApprovalToken minted from a live human approval decision made via POST
// /api/approve. There is no test-mode, auto-approval, or env-var bypass for
// this, ever.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { executeTask, type ExecutionResult } from "./substrate";
import type { Task, Worker } from "./types";

/** Branded so a value can only claim to be an ApprovalToken if mintApprovalToken produced it. */
export type ApprovalToken = {
  readonly __brand: "HumanApproval";
  taskId: string;
  workerId: string;
  approvedBy: string;
  ts: string;
  nonce: string;
  hmac: string;
};

/**
 * Freshness window: an approval token older than this is rejected at
 * executeIrreversible, so a captured token cannot be replayed hours later.
 */
const APPROVAL_FRESHNESS_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Single-use nonce enforcement. A token's nonce is recorded here the first
 * time it is consumed; a second presentation of the same token is rejected as
 * a replay. This is a module-level in-memory set, which is sufficient for a
 * single process. A multi-instance deployment MUST replace this with a shared,
 * atomic check-and-set store (e.g. a "spent_approvals" table or Redis) so a
 * token consumed on one instance cannot be replayed on another.
 */
const spentNonces = new Set<string>();

function spentKey(token: ApprovalToken): string {
  return `${token.taskId}:${token.workerId}:${token.nonce}`;
}

function getSigningSecret(): string {
  const secret = process.env.APPROVAL_SIGNING_SECRET;
  if (!secret) {
    throw new Error(
      "APPROVAL_SIGNING_SECRET environment variable is not set; approval token signing requires it.",
    );
  }
  return secret;
}

function computeHmac(
  taskId: string,
  workerId: string,
  approvedBy: string,
  ts: string,
  nonce: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`${taskId}|${workerId}|${approvedBy}|${ts}|${nonce}`)
    .digest("hex");
}

/**
 * Mints a signed ApprovalToken for a live human approval decision.
 *
 * EXPORT COMMENT: this function may ONLY be imported by
 * app/api/approve/route.ts — that route is the sole place a human approval
 * decision is recorded, and mintApprovalToken must never be reachable from
 * the router, the execution substrate, or a batch script, or the gate could
 * be forged/bypassed from inside the automated pipeline.
 * lib/__tests__/gate.dependency.test.ts (AC-P2b) enforces this by scanning
 * the SOURCE TEXT of lib/router.ts and lib/substrate.ts for the strings
 * "mintApprovalToken" and "APPROVAL_SIGNING_SECRET" and failing if either
 * appears.
 */
export function mintApprovalToken(
  taskId: string,
  approvedBy: string,
  workerId: string,
): ApprovalToken {
  const secret = getSigningSecret();
  const ts = new Date().toISOString();
  const nonce = randomBytes(16).toString("hex");
  const hmac = computeHmac(taskId, workerId, approvedBy, ts, nonce, secret);
  return { __brand: "HumanApproval", taskId, workerId, approvedBy, ts, nonce, hmac };
}

/**
 * Recomputes the HMAC from the token's own fields and timing-safe-compares
 * it against token.hmac. Never throws — a malformed, forged, or otherwise
 * unverifiable token (including non-object / missing-field garbage) simply
 * fails to verify.
 */
export function verifyToken(token: ApprovalToken): boolean {
  if (
    token === null ||
    typeof token !== "object" ||
    typeof token.taskId !== "string" ||
    typeof token.workerId !== "string" ||
    typeof token.approvedBy !== "string" ||
    typeof token.ts !== "string" ||
    typeof token.nonce !== "string" ||
    typeof token.hmac !== "string"
  ) {
    return false;
  }

  let secret: string;
  try {
    secret = getSigningSecret();
  } catch {
    return false;
  }

  const expected = computeHmac(
    token.taskId,
    token.workerId,
    token.approvedBy,
    token.ts,
    token.nonce,
    secret,
  );
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(token.hmac, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * The ONLY path by which an irreversible task's execution may reach the
 * substrate. Throws if the approval token does not verify; otherwise
 * delegates to executeTask exactly as any other agent execution would.
 */
export async function executeIrreversible(
  task: Task,
  worker: Worker,
  token: ApprovalToken,
): Promise<ExecutionResult> {
  if (!verifyToken(token)) {
    throw new Error(`executeIrreversible: approval token for task "${task.id}" failed verification`);
  }

  // Bind the (verified) token to the actual runtime task and worker: a valid
  // token minted to approve Task A / Worker X must not authorize executing a
  // different task or a different worker.
  if (token.taskId !== task.id) {
    throw new Error(
      `executeIrreversible: approval token is for task "${token.taskId}", not "${task.id}"`,
    );
  }
  if (token.workerId !== worker.id) {
    throw new Error(
      `executeIrreversible: approval token is for worker "${token.workerId}", not "${worker.id}"`,
    );
  }

  // Freshness: reject a stale (and therefore likely replayed) token.
  const ageMs = Date.now() - Date.parse(token.ts);
  if (!Number.isFinite(ageMs) || ageMs > APPROVAL_FRESHNESS_MS) {
    throw new Error(
      `executeIrreversible: approval token for task "${task.id}" is expired or has an invalid timestamp`,
    );
  }

  // Anti-replay: consume the nonce atomically before execution. A second
  // presentation of the same token finds it already spent and is rejected.
  const key = spentKey(token);
  if (spentNonces.has(key)) {
    throw new Error(
      `executeIrreversible: approval token for task "${task.id}" has already been used`,
    );
  }
  spentNonces.add(key);

  return executeTask(task, worker);
}

/**
 * Executes a reversible task directly — no approval token needed. Refuses
 * to run an irreversible task; those must go through executeIrreversible.
 */
export async function executeReversible(task: Task, worker: Worker): Promise<ExecutionResult> {
  if (task.reversibility === "irreversible") {
    throw new Error(
      `executeReversible: task "${task.id}" is irreversible and must go through executeIrreversible with a verified approval token`,
    );
  }
  return executeTask(task, worker);
}
