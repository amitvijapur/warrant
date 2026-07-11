import { z } from "zod";
import { approveAndExecute } from "@/lib/pipeline";
import { fail, messageOf, ok } from "../../../_http";

export const dynamic = "force-dynamic";

const Body = z.object({ approvedBy: z.string() });

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
    const result = await approveAndExecute(id, parsed.data.approvedBy);
    return ok(result);
  } catch (err) {
    return fail(messageOf(err));
  }
}
