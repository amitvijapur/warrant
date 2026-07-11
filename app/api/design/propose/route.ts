import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { repos } from "@/lib/repos";
import type { TaskType, Worker } from "@/lib/db-types";
import { fail, messageOf, ok } from "../../_http";

export const dynamic = "force-dynamic";

// Given an EXISTING company and a new need -> an LLM proposes workers and task
// types to ADD to that company's network. Nothing is saved here; the proposal
// is returned for review and the client posts it to /api/design/apply to
// persist. Server-side only.

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
const ProposedWorker = z.object({
  kind: z.enum(["agent", "human"]),
  name: z.string(),
  provider: z.string(), // "" for humans
  model: z.string(), // "" for humans
  costPerTaskUSD: z.number(),
  typicalLatencySec: z.number(),
  humanAxes: HumanAxes,
  aiAxes: AiAxes,
  rationale: z.string(), // one line: why this worker exists for this company
});
const ProposedTaskType = z.object({
  name: z.string(),
  description: z.string(),
  reversibility: z.enum(["reversible", "irreversible"]),
  requiredHumanAxes: HumanAxes,
  requiredAiAxes: AiAxes,
  acceptanceCriteria: z.string(),
});
const Proposal = z.object({
  workers: z.array(ProposedWorker),
  taskTypes: z.array(ProposedTaskType),
});

const Body = z.object({
  companyId: z.string().min(1).max(64),
  needs: z.string().min(1).max(6000),
});

const SYSTEM = `You design the operating architecture for "warrant", a system that routes work to the
best worker (an AI agent or a human) and gates irreversible actions behind human approval.

You are EXTENDING an existing company's network, not designing one from scratch. You are given the
company's name, its current workforce, its current task types, and a description of a new need.
Propose ONLY the workers and task types that should be ADDED to fill a capability, cost-tier, or
coverage gap. Do not propose anything that duplicates a worker or task type already listed — compare
by name, case-insensitively, and if the existing lineup already covers something, leave it out.

Workers (propose 2-4, only what the new need actually calls for — don't pad the list):
- Include AI agents and/or human roles as the gap demands. Use real OpenAI model ids for agents: a
  cheap/fast tier (e.g. gpt-4.1-nano, costPerTaskUSD 0.01-0.03, typicalLatencySec 8-18), a mid tier
  (gpt-4.1-mini, 0.05-0.12, 20-30s), and a strong tier (gpt-4.1, 0.3-0.6, 35-55s) — pick whichever
  tier(s) fill the gap in the existing lineup. For agents set provider="openai" and model to the id;
  leave humans provider="" model="".
- Human roles: costPerTaskUSD 3-12, typicalLatencySec 300-900.
- Axes are 0..1 and must reflect real strengths. AI agents: higher aiAxes (multiStepDecisioning,
  contextCapacity, salienceWeighing) that scale with tier; low-to-moderate humanAxes. Humans: high
  humanAxes (nuance, crossDomain, unbiasedPushback, emotionalStakes, trust); moderate aiAxes.
- Give each worker a one-line rationale tying it to the new need and the gap it fills.

Task types (propose 2-4 — only the new kinds of work this need introduces):
- Set reversibility HONESTLY: anything that commits funds, sends an external communication that
  can't be unsent, or changes a system of record is "irreversible"; internal extraction/summary/
  drafting is "reversible".
- requiredHumanAxes / requiredAiAxes describe what the task demands of a worker (0..1).
- acceptanceCriteria: one concrete, checkable sentence a judge could score output against.

Tailor every name, model tier, cost, axis, and task type to this specific company and its stated
need. No placeholders, and no duplicates of what already exists.`;

function summarizeWorkers(workers: Worker[]): string {
  if (workers.length === 0) return "(none yet)";
  return workers
    .map((w) => {
      const detail = w.kind === "agent" ? `${w.provider ?? "?"}/${w.model ?? "?"}` : "human";
      return `- ${w.name} · ${w.kind} · ${detail} · $${w.costPerTaskUSD.toFixed(2)}/task · ~${w.typicalLatencySec}s`;
    })
    .join("\n");
}

function summarizeTaskTypes(taskTypes: TaskType[]): string {
  if (taskTypes.length === 0) return "(none yet)";
  return taskTypes.map((t) => `- ${t.name} · ${t.reversibility}`).join("\n");
}

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid JSON body", 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.message, 400);
  if (!parsed.data.needs.trim()) return fail("describe the company's needs first", 400);

  try {
    const company = await repos.company.get(parsed.data.companyId);
    if (!company) return fail(`company not found: ${parsed.data.companyId}`, 404);

    const [workers, taskTypes] = await Promise.all([
      repos.worker.list(company.id),
      repos.taskType.list(company.id),
    ]);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.DESIGN_MODEL ?? "gpt-4o";
    const completion = await client.chat.completions.parse({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Company: ${company.name}

Existing workforce:
${summarizeWorkers(workers)}

Existing task types:
${summarizeTaskTypes(taskTypes)}

New need to cover:
${parsed.data.needs}`,
        },
      ],
      response_format: zodResponseFormat(Proposal, "proposal"),
    });
    const proposal = completion.choices[0]?.message?.parsed;
    if (!proposal) return fail("the designer returned no proposal — try again");
    return ok(proposal);
  } catch (err) {
    return fail(messageOf(err));
  }
}
