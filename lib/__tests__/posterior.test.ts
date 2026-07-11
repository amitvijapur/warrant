import { describe, expect, it } from "vitest";

import { ci90, mean, newPosterior, update } from "../posterior";
import goldenFixtures from "../golden-fixtures.json";
import type { Posterior } from "../types";

describe("posterior golden fixtures (scipy.stats.beta.ppf)", () => {
  for (const fixture of goldenFixtures.fixtures) {
    it(`Beta(${fixture.alpha}, ${fixture.beta}) matches scipy`, () => {
      const p: Posterior = { alpha: fixture.alpha, beta: fixture.beta };

      expect(mean(p)).toBeCloseTo(fixture.mean, 9);

      const [lower, upper] = ci90(p);
      expect(Math.abs(lower - fixture.ci90[0])).toBeLessThanOrEqual(1e-3);
      expect(Math.abs(upper - fixture.ci90[1])).toBeLessThanOrEqual(1e-3);
    });
  }
});

describe("posterior monotone shrink", () => {
  it("interval width strictly decreases over 10 successive successes from Beta(1,1)", () => {
    let p = newPosterior();
    let prevWidth = ci90(p)[1] - ci90(p)[0];

    for (let i = 0; i < 10; i++) {
      p = update(p, true);
      const [lower, upper] = ci90(p);
      const width = upper - lower;
      expect(width).toBeLessThan(prevWidth);
      prevWidth = width;
    }
  });

  it("interval width strictly decreases over an alternating success/failure sequence of 10 from Beta(1,1)", () => {
    let p = newPosterior();
    let prevWidth = ci90(p)[1] - ci90(p)[0];

    for (let i = 0; i < 10; i++) {
      p = update(p, i % 2 === 0);
      const [lower, upper] = ci90(p);
      const width = upper - lower;
      // A genuine tie (within float noise) would indicate the interval
      // stopped shrinking on this step — report it rather than relaxing
      // the assertion, per the block's verification contract.
      expect(
        width,
        `width did not strictly decrease at step ${i}: prev=${prevWidth}, cur=${width}`,
      ).toBeLessThan(prevWidth);
      prevWidth = width;
    }
  });
});
