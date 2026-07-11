import { z } from "zod";
import { submitHumanOutput } from "@/lib/pipeline";
import { fail, messageOf, ok } from "../../../_http";

export const dynamic = "force-dynamic";

const Body = z.object({ output: z.string().min(1).max(20000) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid JSON body", 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.message, 400);
  try {
    const result = await submitHumanOutput(id, parsed.data.output);
    return ok(result);
  } catch (err) {
    return fail(messageOf(err));
  }
}
