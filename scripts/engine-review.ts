// One-off adversarial correctness review of the warrant engine, run through the
// OpenAI API (our own key). It gathers the pure engine + orchestration source and
// asks a strong model to find logic shortcomings, edge cases, and — above all —
// any path that could violate the gate invariant. Output is written to
// engine-review-output.md and printed. This is a QC aid, not part of the product.
//
//   npx tsx scripts/engine-review.ts
import "./env";

import { readFileSync, writeFileSync } from "node:fs";
import OpenAI from "openai";

const FILES = [
  "lib/config.ts",
  "lib/types.ts",
  "lib/posterior.ts",
  "lib/scorer.ts",
  "lib/router.ts",
  "lib/gate.ts",
  "lib/reputation.ts",
  "lib/classify.ts",
  "lib/judge.ts",
  "lib/substrate.ts",
  "lib/pipeline.ts",
];

const SYSTEM = `You are a staff-level engineer performing an ADVERSARIAL correctness review of a
task-routing engine called "warrant". Be skeptical and specific. Do not praise; hunt for defects.

The engine's job: route a task to the best worker (an AI agent or a human), gate irreversible
actions behind a signed human approval, and learn worker reliability from judged outcomes.

Focus your review, in this priority order:
1. THE GATE INVARIANT: is there ANY code path where an irreversible agent action executes
   without a valid, freshly-minted, human-authorized ApprovalToken? Trace executeAssignment,
   approveAndExecute, and gate.ts. Nonce reuse, token forgery, timing attacks, missing checks.
2. ROUTER SCORING: is the score math coherent? normalization (log cost, linear latency),
   weight application, the capability/judgment/risk trigger cascade — ordering, precedence,
   and whether any trigger can misfire or be skipped. Ties, empty worker lists, all-human or
   all-agent pools, zero-cost/zero-latency edge cases.
3. REPUTATION: is the Beta posterior update honest and correctly keyed by (worker, task type)?
   Is the verdict selection (confirmed vs judge) right? Can reputation be gamed or reset wrongly?
4. CLASSIFY / JUDGE: prompt or parsing weaknesses, confidence handling, failure modes if the
   model returns something unexpected. Could the judge be trivially fooled or the classifier
   mis-route silently?
5. GENERAL: off-by-one, null/undefined handling, floating-point, async ordering, any logic bug.

For each finding give: SEVERITY (critical/high/medium/low), the file, a one-line defect
statement, a concrete failure scenario (inputs -> wrong result), and a suggested fix. End with
the single most important thing to fix before a public demo. Be concise and concrete.`;

async function main(): Promise<void> {
  const bundle = FILES.map((f) => {
    let src = "";
    try {
      src = readFileSync(f, "utf8");
    } catch {
      src = "// (file not found)";
    }
    return `\n// ===== ${f} =====\n${src}`;
  }).join("\n");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const user = `Review the following warrant engine source in full.\n${bundle}`;

  const models = ["gpt-5", "gpt-4.1"];
  let review = "";
  let used = "";
  for (const model of models) {
    try {
      process.stderr.write(`\n[engine-review] asking ${model}…\n`);
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      });
      review = res.choices[0]?.message?.content ?? "";
      used = model;
      if (review.trim()) break;
    } catch (err) {
      process.stderr.write(`[engine-review] ${model} failed: ${(err as Error).message}\n`);
    }
  }

  if (!review.trim()) {
    console.error("engine-review: no model returned a review");
    process.exit(1);
  }

  const out = `# warrant engine — adversarial correctness review\n\n_Model: ${used}. Files: ${FILES.length}._\n\n${review}\n`;
  writeFileSync("engine-review-output.md", out);
  console.log(out);
  console.log(`\n[engine-review] written to engine-review-output.md (model: ${used})`);
}

main().catch((err) => {
  console.error("engine-review failed:", err);
  process.exit(1);
});
