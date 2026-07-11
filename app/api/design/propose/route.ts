import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { fail, messageOf, ok } from "../../_http";

export const dynamic = "force-dynamic";

// Describe a company + its needs -> an LLM proposes a workforce and task types
// tailored to it. Nothing is saved here; the proposal is returned for review and
// the client posts it to /api/design/apply to persist. Server-side only.

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
  name: z.string().max(200),
  needs: z.string().min(1).max(6000),
});

const SYSTEM = `You design the operating architecture for "warrant", a system that routes work to the
best worker (an AI agent or a human) and gates irreversible actions behind human approval.

Given a company and its needs, propose a realistic MIXED workforce and the kinds of work it does,
tailored specifically to this company. Be concrete and grounded in what the company actually does.

Workers (propose 3-5 total):
- Include 2-4 AI agents across capability/cost tiers. Use real OpenAI model ids: a cheap/fast tier
  (e.g. gpt-4.1-nano, costPerTaskUSD 0.01-0.03, typicalLatencySec 8-18), a mid tier
  (gpt-4.1-mini, 0.05-0.12, 20-30s), and optionally a strong tier (gpt-4.1, 0.3-0.6, 35-55s).
  For agents set provider="openai" and model to the id; leave humans provider="" model="".
- Include 1-2 human roles relevant to this company (e.g. an operator, a specialist). Humans:
  costPerTaskUSD 3-12, typicalLatencySec 300-900.
- Axes are 0..1 and must reflect real strengths. AI agents: higher aiAxes (multiStepDecisioning,
  contextCapacity, salienceWeighing) that scale with tier; low-to-moderate humanAxes. Humans: high
  humanAxes (nuance, crossDomain, unbiasedPushback, emotionalStakes, trust); moderate aiAxes.
- Give each worker a one-line rationale tying it to this company.

Task types (propose 3-6):
- The concrete kinds of work this company routes. Set reversibility HONESTLY: anything that commits
  funds, sends an external communication that can't be unsent, or changes a system of record is
  "irreversible"; internal extraction/summary/drafting is "reversible".
- requiredHumanAxes / requiredAiAxes describe what the task demands of a worker (0..1).
- acceptanceCriteria: one concrete, checkable sentence a judge could score output against.

Tailor every name, model tier, cost, axis, and task type to the described company. No placeholders.`;

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
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.DESIGN_MODEL ?? "gpt-4o";
    const completion = await client.chat.completions.parse({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Company name: ${parsed.data.name || "(unnamed)"}\n\nNeeds / description:\n${parsed.data.needs}`,
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
