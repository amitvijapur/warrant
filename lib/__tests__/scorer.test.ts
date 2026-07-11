import { describe, expect, it } from "vitest";

import { contentWords, scoreOutcome } from "../scorer";
import type { Task } from "../types";

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

describe("contentWords", () => {
  it("lowercases, strips punctuation, and drops words of length <= 3", () => {
    expect(contentWords("The apple, ORANGE! and a kiwi123 too.")).toEqual([
      "apple",
      "orange",
      "kiwi123",
    ]);
  });
});

describe("scoreOutcome / invoice_extraction", () => {
  const task = makeTask({
    id: "task_invoice",
    type: "invoice_extraction",
    groundTruth: {
      vendor: "Acme Corp",
      invoiceNumber: "INV-1001",
      date: "2026-03-15",
      totalAmount: 1234.56,
      currency: "USD",
    },
  });

  it("succeeds when all fields match, tolerating a code fence and case/whitespace on vendor", () => {
    const output =
      "Here is the extracted data:\n```json\n" +
      '{"vendor": "  ACME CORP  ", "invoiceNumber": "INV-1001", "date": "2026-03-15", ' +
      '"totalAmount": 1234.56, "currency": "USD"}\n```';

    const result = scoreOutcome(task, output);
    expect(result.success).toBe(true);
  });

  it("fails and names mismatched fields when totalAmount and currency are wrong", () => {
    const output =
      '{"vendor": "Acme Corp", "invoiceNumber": "INV-1001", "date": "2026-03-15", ' +
      '"totalAmount": 999.99, "currency": "EUR"}';

    const result = scoreOutcome(task, output);
    expect(result.success).toBe(false);
    expect(result.detail).toContain("totalAmount");
    expect(result.detail).toContain("currency");
  });

  it("parses JSON even when a string value contains braces (finding #7)", () => {
    const bracedTask = makeTask({
      id: "task_invoice_braced",
      type: "invoice_extraction",
      groundTruth: {
        vendor: "Acme {Holdings}",
        invoiceNumber: "A-1",
        date: "2026-01-01",
        totalAmount: 100,
        currency: "USD",
      },
    });
    // The literal "{" inside the vendor value used to unbalance the naive brace
    // counter and return "no JSON object found".
    const output =
      '{"vendor":"Acme {Holdings}","invoiceNumber":"A-1","date":"2026-01-01",' +
      '"totalAmount":100,"currency":"USD"}';

    const result = scoreOutcome(bracedTask, output);
    expect(result.detail).not.toContain("no JSON object found");
    expect(result.success).toBe(true);
  });
});

describe("scoreOutcome / email_triage", () => {
  const task = makeTask({
    id: "task_email",
    type: "email_triage",
    groundTruth: {
      category: "billing",
      requiredPoints: [
        "We apologize for the duplicate charge",
        "A refund will be processed within 5 business days",
      ],
    },
  });

  it("succeeds when the category matches and both required points are covered", () => {
    const output =
      "CATEGORY: billing\n\n" +
      "Thank you for reaching out. We apologize for the duplicate charge on your account. " +
      "A refund will be processed within 5 business days and you should see it reflected " +
      "on your statement shortly. Please let us know if you have any other questions.";

    const result = scoreOutcome(task, output);
    expect(result.success).toBe(true);
  });

  it("fails and reports both the category mismatch and the missed point", () => {
    const output =
      "CATEGORY: technical\n\n" +
      "We apologize for the duplicate charge on your account and are looking into the issue.";

    const result = scoreOutcome(task, output);
    expect(result.success).toBe(false);
    expect(result.detail).toContain("category mismatch");
    expect(result.detail).toContain("missed points");
  });
});

describe("scoreOutcome / report_summary", () => {
  const task = makeTask({
    id: "task_report",
    type: "report_summary",
    groundTruth: {
      keyFacts: [
        "Revenue grew 12% year over year",
        "The company expanded into three new markets",
        "Customer churn decreased significantly",
        "A new product line launched in Q3",
      ],
    },
  });

  it("succeeds when at least 75% of key facts are covered (3 of 4)", () => {
    const output =
      "Revenue grew 12% year over year, driven largely by strong renewal rates. " +
      "The company expanded into three new markets during the same period, and customer " +
      "churn decreased significantly thanks to the improved onboarding flow.";

    const result = scoreOutcome(task, output);
    expect(result.success).toBe(true);
    expect(result.detail).toContain("3/4");
  });

  it("fails when only half of the key facts are covered", () => {
    const output =
      "The company expanded into three new markets during the same period, and customer " +
      "churn decreased significantly thanks to the improved onboarding flow.";

    const result = scoreOutcome(task, output);
    expect(result.success).toBe(false);
    expect(result.detail).toContain("uncovered facts");
  });
});
