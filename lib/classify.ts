// Task classification: an LLM picks the best-matching company task type for a
// free-text task input and flags its reversibility. The requirement profile
// (axes) is NOT produced here — it lives on the chosen task type and is read
// downstream (see lib/pipeline.ts routeTask). This module only decides "which
// task type is this?" plus a reversibility flag, a confidence, and a reason.
//
// Structured output: the OpenAI SDK's json_schema mode (chat.completions.parse
// + zodResponseFormat) constrains the model to return exactly our shape, and we
// re-validate the parsed result with zod as a belt-and-braces check. The client
// is constructed lazily so importing this module never requires an API key.

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { TaskType } from "./db-types";
import type { Reversibility } from "./types";

export type Classification = {
  taskTypeId: string;
  reversibility: Reversibility;
  confidence: number;
  reasoning: string;
};

/** Stable validation schema for the parsed result (taskTypeId as free string). */
const ClassificationSchema = z.object({
  taskTypeId: z.string(),
  reversibility: z.enum(["reversible", "irreversible"]),
  confidence: z.number(),
  reasoning: z.string(),
});

let client: OpenAI | null = null;

/** Lazily construct the OpenAI client (reads OPENAI_API_KEY at call time). */
function getClient(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}

function classifierModel(): string {
  return process.env.CLASSIFIER_MODEL ?? "gpt-4o-mini";
}

/**
 * Classifies `input` against the company's `taskTypes`. The response schema
 * pins `taskTypeId` to an enum of the provided ids, so the model cannot invent
 * an id. Throws if there are no task types to choose from, or if the model
 * returns nothing parseable.
 */
export async function classifyTask(
  input: string,
  taskTypes: TaskType[],
): Promise<Classification> {
  if (taskTypes.length === 0) {
    throw new Error("classifyTask: no task types provided to classify against");
  }

  const ids = taskTypes.map((t) => t.id) as [string, ...string[]];

  // Request schema constrains taskTypeId to a valid id via a dynamic enum.
  const RequestSchema = z.object({
    taskTypeId: z.enum(ids),
    reversibility: z.enum(["reversible", "irreversible"]),
    confidence: z.number(),
    reasoning: z.string(),
  });

  const catalog = taskTypes
    .map(
      (t) =>
        `- id: ${t.id}\n  name: ${t.name}\n  description: ${t.description}\n` +
        `  default_reversibility: ${t.reversibility}`,
    )
    .join("\n");

  const system =
    "You are a task router's classifier. Given a task's free-text input and a " +
    "catalog of a company's task types, choose the single best-matching task " +
    "type by its id, judge whether carrying out this specific task is " +
    "reversible or irreversible, and give a calibrated confidence in [0,1] with " +
    "a one-sentence reason.";

  const user =
    `Task input:\n${input}\n\n` +
    `Task type catalog:\n${catalog}\n\n` +
    "Pick the id of the best-matching task type.";

  // No temperature is passed — determinism lives in the schema, not sampling.
  const completion = await getClient().chat.completions.parse({
    model: classifierModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: zodResponseFormat(RequestSchema, "classification"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error("classifyTask: model returned no parseable classification");
  }

  const validated = ClassificationSchema.parse(parsed);
  // Confidence is clamped rather than schema-constrained: strict json_schema
  // does not enforce numeric bounds, so we normalize defensively.
  const confidence = Math.min(1, Math.max(0, validated.confidence));
  return { ...validated, confidence };
}
