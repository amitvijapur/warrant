// Deterministic outcome scoring — no LLM calls, no I/O. Turns a Task's
// groundTruth and a raw model output string into a success/detail verdict.
// This is the optional "structured scoring" strategy: it applies to the
// known TaskTypes that ship with a ground-truth contract.
//
// Task.groundTruth is typed `unknown` in the frozen contract (types.ts); the
// shapes below are the runtime contract this module assumes per TaskType.

import type { Task } from "./types";

type InvoiceGroundTruth = {
  vendor: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  currency: string;
};

type EmailTriageGroundTruth = {
  category: "billing" | "technical" | "complaint" | "general";
  requiredPoints: string[];
};

type ReportSummaryGroundTruth = {
  keyFacts: string[];
};

export type ScoreResult = { success: boolean; detail: string };

/** Lowercased, alphanumeric-only, length > 3 content words — used for coverage checks. */
export function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 3);
}

/** A point/fact is covered iff at least 60% of its content words appear in the output. */
function isCovered(point: string, outputWords: Set<string>): boolean {
  const words = contentWords(point);
  if (words.length === 0) return true;
  const matched = words.filter((w) => outputWords.has(w)).length;
  return matched / words.length >= 0.6;
}

/** Extracts the first well-formed JSON object from text, tolerating ```-fences and prose around it. */
function extractFirstJsonObject(text: string): unknown | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1] : text;

  const start = candidate.indexOf("{");
  if (start === -1) return null;

  // Count braces only OUTSIDE of string literals, tracking escape state, so a
  // brace inside a value like "Acme {Holdings}" doesn't throw off the depth.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function scoreInvoiceExtraction(task: Task, output: string): ScoreResult {
  const truth = task.groundTruth as InvoiceGroundTruth;
  const parsed = extractFirstJsonObject(output) as Partial<InvoiceGroundTruth> | null;

  if (!parsed) {
    return { success: false, detail: "no JSON object found in output" };
  }

  const mismatches: string[] = [];
  const miss = (field: string, got: unknown, want: unknown) =>
    mismatches.push(`${field} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

  // Vendor identity must not hinge on punctuation, spacing, or case
  // conventions (a trailing "Ltd." vs "LTD" is not an extraction error) —
  // but OCR digit/letter substitutions remain significant, so normalizing
  // "PH0NG" to "Phong" is still the worker's job.
  const canonVendor = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const vendorMatch =
    typeof parsed.vendor === "string" && canonVendor(parsed.vendor) === canonVendor(truth.vendor);
  if (!vendorMatch) miss("vendor", parsed.vendor, truth.vendor);

  // Revision annotations like "(rev.1)" printed inline after the number are
  // not part of the invoice number, and internal spacing is cosmetic; strip
  // both from BOTH sides before comparing. Glyph normalization (1 vs I,
  // | vs I) remains the worker's job — no character substitution here.
  const canonInvoiceNumber = (s: string) =>
    s.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+/g, "").trim();
  const invoiceNumberMatch =
    typeof parsed.invoiceNumber === "string" &&
    canonInvoiceNumber(parsed.invoiceNumber) === canonInvoiceNumber(truth.invoiceNumber);
  if (!invoiceNumberMatch) miss("invoiceNumber", parsed.invoiceNumber, truth.invoiceNumber);

  const dateMatch = typeof parsed.date === "string" && parsed.date.trim() === truth.date;
  if (!dateMatch) miss("date", parsed.date, truth.date);

  const totalMatch =
    typeof parsed.totalAmount === "number" && Math.abs(parsed.totalAmount - truth.totalAmount) < 0.01;
  if (!totalMatch) miss("totalAmount", parsed.totalAmount, truth.totalAmount);

  const currencyMatch = typeof parsed.currency === "string" && parsed.currency.trim() === truth.currency;
  if (!currencyMatch) miss("currency", parsed.currency, truth.currency);

  const success = mismatches.length === 0;
  return {
    success,
    detail: success ? "all fields match" : `mismatched: ${mismatches.join("; ")}`,
  };
}

/** Parses `CATEGORY: x` from the first few lines of output, case-insensitively. */
function parseCategory(output: string): string | null {
  const lines = output.split("\n").slice(0, 5);
  for (const line of lines) {
    const match = line.match(/CATEGORY:\s*(\w+)/i);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

function scoreEmailTriage(task: Task, output: string): ScoreResult {
  const truth = task.groundTruth as EmailTriageGroundTruth;
  const category = parseCategory(output);
  const categoryMatch = category === truth.category.toLowerCase();

  const outputWords = new Set(contentWords(output));
  const missedPoints = truth.requiredPoints.filter((point) => !isCovered(point, outputWords));

  const success = categoryMatch && missedPoints.length === 0;

  const details: string[] = [];
  if (!categoryMatch) {
    details.push(`category mismatch (expected ${truth.category}, got ${category ?? "none"})`);
  }
  if (missedPoints.length > 0) {
    details.push(`missed points: ${missedPoints.join("; ")}`);
  }

  return {
    success,
    detail: success ? "category and all required points covered" : details.join("; "),
  };
}

function scoreReportSummary(task: Task, output: string): ScoreResult {
  const truth = task.groundTruth as ReportSummaryGroundTruth;
  const outputWords = new Set(contentWords(output));
  const uncoveredFacts = truth.keyFacts.filter((fact) => !isCovered(fact, outputWords));
  const coveredCount = truth.keyFacts.length - uncoveredFacts.length;
  const coverageRatio = truth.keyFacts.length === 0 ? 1 : coveredCount / truth.keyFacts.length;
  const success = coverageRatio >= 0.75;

  return {
    success,
    detail: success
      ? `covered ${coveredCount}/${truth.keyFacts.length} key facts`
      : `uncovered facts: ${uncoveredFacts.join("; ")}`,
  };
}

export function scoreOutcome(task: Task, output: string): ScoreResult {
  switch (task.type) {
    case "invoice_extraction":
      return scoreInvoiceExtraction(task, output);
    case "email_triage":
      return scoreEmailTriage(task, output);
    case "report_summary":
      return scoreReportSummary(task, output);
  }
}
