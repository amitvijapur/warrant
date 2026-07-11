import { routeTask } from "@/lib/pipeline";
import { fail, messageOf, ok } from "../../../_http";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const result = await routeTask(id);
    return ok(result);
  } catch (err) {
    return fail(messageOf(err));
  }
}
