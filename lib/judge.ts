// LLM judge: scores a completed task output against its task type's acceptance
// criteria and returns a pass/fail verdict with a concise reason. This is the
// general, criteria-driven counterpart to the deterministic lib/scorer.ts
// (which only covers the three legacy task types with a ground-truth contract).
//
// Structured output via chat.completions.parse + zodResponseFormat, re-validated
// with zod. The client is constructed lazily so import never requires a key.

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

export type JudgeResult = {
  pass: boolean;
  detail: string;
};

const JudgeSchema = z.object({
  pass: z.boolean(),
  detail: z.string(),
});

let client: OpenAI | null = null;

/** Lazily construct the OpenAI client (reads OPENAI_API_KEY at call time). */
function getClient(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}

function judgeModel(): string {
  return process.env.JUDGE_MODEL ?? "gpt-4o";
}

/**
 * Judges whether `output` satisfies `acceptanceCriteria` for the given
 * `taskInput`. `detail` is a concise reason: what passed, or what was missing.
 * Throws if the model returns nothing parseable.
 */
export async function judgeOutput(
  taskInput: string,
  output: string,
  acceptanceCriteria: string,
): Promise<JudgeResult> {
  const system =
    "You are a strict but fair evaluator. Decide whether the worker's output " +
    "satisfies the task's acceptance criteria for the given input. Pass only if " +
    "the criteria are genuinely met. Keep `detail` to one concise sentence " +
    "stating the reason to pass or exactly what was missing.";

  const user =
    `Task input:\n${taskInput}\n\n` +
    `Acceptance criteria:\n${acceptanceCriteria}\n\n` +
    `Worker output:\n${output}`;

  // No temperature is passed — determinism lives in the schema, not sampling.
  const completion = await getClient().chat.completions.parse({
    model: judgeModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: zodResponseFormat(JudgeSchema, "judgement"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error("judgeOutput: model returned no parseable judgement");
  }

  return JudgeSchema.parse(parsed);
}
