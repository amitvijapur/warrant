// Router tuning constants.

/** Weighted contribution shape used by scoreWorker's linear combination. */
export type RouterWeights = {
  axis: number;
  cost: number;
  latency: number;
  reliability: number;
};

// Calibrated analytically 2026-07-11 BEFORE any evidence run, then frozen.
// Never retuned after observing outcomes (honesty line). Full derivation,
// including the infeasibility finding that motivated the judgment trigger,
// lives in docs/weight-calibration.md.
export const ROUTER_WEIGHTS: RouterWeights = {
  axis: 0.33,
  cost: 0.21,
  latency: 0.01,
  reliability: 0.45,
};

/**
 * Mean-axis threshold (on both the 5 humanAxes and the 3 aiAxes) above
 * which a task is considered to genuinely need both human judgment and AI
 * throughput, firing the capability trigger in routeTask.
 */
export const CAPABILITY_TRIGGER_THRESHOLD = 0.6;
