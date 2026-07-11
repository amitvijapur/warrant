import { z } from "zod";
import { repos } from "@/lib/repos";
import { fail, messageOf, ok } from "../../_http";

export const dynamic = "force-dynamic";

// Persist a reviewed design proposal onto an EXISTING company: adds the
// proposed workers and task types that don't already exist there. The
// proposal shape mirrors /api/design/propose. Idempotent by name (case-
// insensitive) — re-applying the same proposal never creates duplicates.

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
  companyId: z.string().min(1).max(64),
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
  const { companyId, workers, taskTypes } = parsed.data;

  try {
    const company = await repos.company.get(companyId);
    if (!company) return fail(`company not found: ${companyId}`, 404);

    const [existingWorkers, existingTaskTypes] = await Promise.all([
      repos.worker.list(companyId),
      repos.taskType.list(companyId),
    ]);
    const existingWorkerNames = new Set(existingWorkers.map((w) => w.name.trim().toLowerCase()));
    const existingTaskTypeNames = new Set(
      existingTaskTypes.map((t) => t.name.trim().toLowerCase()),
    );

    let workersAdded = 0;
    for (const w of workers) {
      const key = w.name.trim().toLowerCase();
      if (existingWorkerNames.has(key)) continue;
      const isAgent = w.kind === "agent";
      await repos.worker.create({
        companyId,
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
      existingWorkerNames.add(key);
      workersAdded++;
    }

    let taskTypesAdded = 0;
    for (const t of taskTypes) {
      const key = t.name.trim().toLowerCase();
      if (existingTaskTypeNames.has(key)) continue;
      await repos.taskType.create({
        companyId,
        name: t.name,
        description: t.description,
        reversibility: t.reversibility,
        requiredHumanAxes: t.requiredHumanAxes,
        requiredAiAxes: t.requiredAiAxes,
        acceptanceCriteria: t.acceptanceCriteria,
      });
      existingTaskTypeNames.add(key);
      taskTypesAdded++;
    }

    return ok({ company, added: { workers: workersAdded, taskTypes: taskTypesAdded } });
  } catch (err) {
    return fail(messageOf(err));
  }
}
