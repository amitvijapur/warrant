// Beta-distribution posterior math for worker reliability.
//
// Deliberately hand-rolled with NO special functions (no gamma, no
// log-gamma, no inverse incomplete beta) anywhere in this file. The
// credible interval is computed by evaluating the unnormalized Beta
// kernel on a fine grid, integrating with the trapezoid rule, and
// reading off the normalized-CDF crossings with linear interpolation.

import type { Posterior } from "./types";

/** Number of interior grid points used for ci90/mean integration. */
const CI_GRID_POINTS = 4001;

export function newPosterior(): Posterior {
  return { alpha: 1, beta: 1 };
}

/** Pure one-line conjugate Beta-Bernoulli update. */
export function update(p: Posterior, success: boolean): Posterior {
  return success ? { alpha: p.alpha + 1, beta: p.beta } : { alpha: p.alpha, beta: p.beta + 1 };
}

export function mean(p: Posterior): number {
  return p.alpha / (p.alpha + p.beta);
}

/**
 * Log of the unnormalized Beta kernel: (alpha-1)·ln(x) + (beta-1)·ln(1-x).
 * Working in log-space and rescaling by the grid maximum (see kernelYs) keeps
 * large-alpha/beta kernels from underflowing every grid point to 0 — which
 * would otherwise make the trapezoid total 0 and yield NaN CDFs. No gamma
 * function needed; xs are strictly interior to (0, 1) so both logs are finite.
 */
function logKernel(x: number, alpha: number, beta: number): number {
  return (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x);
}

/**
 * Evaluate the kernel on `xs`, rescaled so its peak is 1 (exp(logK - maxLog)).
 * The uniform rescale cancels in any subsequent normalization (CDF/total or
 * y/maxY), so results match the raw kernel while staying underflow-safe.
 * Returns all-zero ys only in the degenerate case where every logK is -∞.
 */
function kernelYs(xs: number[], alpha: number, beta: number): number[] {
  const logs = xs.map((x) => logKernel(x, alpha, beta));
  const maxLog = Math.max(...logs);
  if (!Number.isFinite(maxLog)) return xs.map(() => 0);
  return logs.map((l) => Math.exp(l - maxLog));
}

/**
 * A uniform grid of `n` points strictly inside (0, 1) — never touches the
 * endpoints, so x^0 never has to be evaluated at x = 0 and (1-x)^0 never
 * has to be evaluated at x = 1 (avoids any 0^0 ambiguity).
 */
function grid(n: number): number[] {
  const step = 1 / (n + 1);
  const xs = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    xs[i] = step * (i + 1);
  }
  return xs;
}

function crossing(xs: number[], cdf: number[], target: number): number {
  if (target <= cdf[0]) return xs[0];
  const last = cdf.length - 1;
  if (target >= cdf[last]) return xs[last];
  for (let i = 1; i < cdf.length; i++) {
    if (cdf[i] >= target) {
      const x0 = xs[i - 1];
      const x1 = xs[i];
      const c0 = cdf[i - 1];
      const c1 = cdf[i];
      const t = (target - c0) / (c1 - c0);
      return x0 + t * (x1 - x0);
    }
  }
  return xs[last];
}

/**
 * 90% credible interval via grid integration: evaluate the unnormalized
 * kernel on a uniform grid of `CI_GRID_POINTS` points strictly inside
 * (0, 1), cumulative-trapezoid it, normalize, and read the 5%/95%
 * crossings with linear interpolation between grid points.
 */
export function ci90(p: Posterior): [number, number] {
  const xs = grid(CI_GRID_POINTS);
  const ys = kernelYs(xs, p.alpha, p.beta);

  const cdf = new Array<number>(xs.length);
  cdf[0] = 0;
  for (let i = 1; i < xs.length; i++) {
    const dx = xs[i] - xs[i - 1];
    cdf[i] = cdf[i - 1] + ((ys[i] + ys[i - 1]) / 2) * dx;
  }
  const total = cdf[cdf.length - 1];
  // Degenerate mass (should not happen once rescaled, but guard anyway):
  // collapse to a delta at the mean rather than divide by zero into NaNs.
  if (!(total > 0)) {
    const m = mean(p);
    return [m, m];
  }
  const normalized = cdf.map((c) => c / total);

  const lower = crossing(xs, normalized, 0.05);
  const upper = crossing(xs, normalized, 0.95);
  return [lower, upper];
}

/**
 * Unnormalized kernel points for rendering, scaled so the maximum y is 1.
 */
export function pdfPoints(p: Posterior, n = 200): { x: number; y: number }[] {
  const xs = grid(n);
  const ys = kernelYs(xs, p.alpha, p.beta);
  const maxY = Math.max(...ys);
  // kernelYs already peaks at 1, but guard against an all-zero degenerate grid.
  if (!(maxY > 0)) return xs.map((x) => ({ x, y: 0 }));
  return xs.map((x, i) => ({ x, y: ys[i] / maxY }));
}
