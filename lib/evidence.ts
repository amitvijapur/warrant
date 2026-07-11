// Evidence ledger: a best-effort audit sidecar for the pipeline. Records
// decision/gate/approval events so who-approved-what-and-when is traceable.
//
// This is intentionally a thin, pluggable sink registry (mirroring the
// substrate provider registry): the engine emits events by calling
// appendEvidence, and a persistent sink (DB writer, append-only file) is
// registered by the app at startup. With no sink registered it is a no-op, so
// the pure engine stays I/O-free and unit-testable, and — like Langfuse in the
// substrate — evidence MUST NEVER fail the operation it records.

import type { EvidenceEvent } from "./types";

export type EvidenceSink = (event: EvidenceEvent) => void | Promise<void>;

const sinks: EvidenceSink[] = [];

/** Register a persistent evidence sink (e.g. a DB writer). Called at app startup. */
export function registerEvidenceSink(sink: EvidenceSink): void {
  sinks.push(sink);
}

/** Test/inspection helper: drop all registered sinks. */
export function clearEvidenceSinks(): void {
  sinks.length = 0;
}

/**
 * Best-effort: fan an evidence event out to every registered sink. NEVER
 * throws — a failing sink logs one warning and is skipped so the recorded
 * operation is never affected.
 */
export async function appendEvidence(event: EvidenceEvent): Promise<void> {
  for (const sink of sinks) {
    try {
      await sink(event);
    } catch (err) {
      console.warn("evidence sink failed, continuing:", err);
    }
  }
}
