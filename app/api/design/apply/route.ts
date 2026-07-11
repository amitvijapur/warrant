import { z } from "zod";
import { repos } from "@/lib/repos";
import { fail, messageOf, ok } from "../../_http";

export const dynamic = "force-dynamic";

// Persist a reviewed design proposal as a new company with its workers and task
// types. The proposal shape mirrors /api/design/propose.

const HumanAxes = z.object({
  nuance: z.number(),
  crossDomain: z.number(),
  unbiasedPushback: z.number(),
  emotionalStakes: z.number(),
  trust: z.number(),
});
const AiAxes = z.object({
  multiStepDecisioning: z.number(),
  contextCapacity: z.number(),
  salienceWeighing: z.number(),
});
const Body = z.object({
  name: z.string().min(1, "a company name is required"),
  workers: z
    .array(
      z.object({
        kind: z.enum(["agent", "human"]),
        name: z.string().min(1),
        provider: z.string().optional().default(""),
        model: z.string().optional().default(""),
        costPerTaskUSD: z.number(),
        typicalLatencySec: z.number(),
        humanAxes: HumanAxes,
        aiAxes: AiAxes,
      }),
    )
    .min(1, "at least one worker is required"),
  taskTypes: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string(),
        reversibility: z.enum(["reversible", "irreversible"]),
        requiredHumanAxes: HumanAxes,
        requiredAiAxes: AiAxes,
        acceptanceCriteria: z.string(),
      }),
    )
    .min(1, "at least one task type is required"),
});

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid JSON body", 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.message, 400);
  const { name, workers, taskTypes } = parsed.data;

  try {
    const company = await repos.company.create({ name });
    for (const w of workers) {
      const isAgent = w.kind === "agent";
      await repos.worker.create({
        companyId: company.id,
        kind: w.kind,
        name: w.name,
        provider: isAgent ? w.provider || "openai" : null,
        model: isAgent ? w.model || null : null,
        humanAxes: w.humanAxes,
        aiAxes: w.aiAxes,
        costPerTaskUSD: w.costPerTaskUSD,
        typicalLatencySec: w.typicalLatencySec,
        active: true,
      });
    }
    for (const t of taskTypes) {
      await repos.taskType.create({
        companyId: company.id,
        name: t.name,
        description: t.description,
        reversibility: t.reversibility,
        requiredHumanAxes: t.requiredHumanAxes,
        requiredAiAxes: t.requiredAiAxes,
        acceptanceCriteria: t.acceptanceCriteria,
      });
    }
    return ok({ company });
  } catch (err) {
    return fail(messageOf(err));
  }
}
