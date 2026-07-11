import { repos } from "@/lib/repos";
import { fail, messageOf, ok } from "../../../_http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const taskTypes = await repos.taskType.list(id);
    return ok(taskTypes);
  } catch (err) {
    return fail(messageOf(err));
  }
}
