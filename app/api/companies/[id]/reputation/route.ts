import { mean } from "@/lib/posterior";
import { buildReputation } from "@/lib/reputation";
import { fail, messageOf, ok } from "../../../_http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const map = await buildReputation(id);
    const rows = Array.from(map.entries()).map(([key, posterior]) => {
      const [workerId, taskTypeId] = key.split(":");
      return {
        workerId,
        taskTypeId,
        alpha: posterior.alpha,
        beta: posterior.beta,
        mean: mean(posterior),
      };
    });
    return ok(rows);
  } catch (err) {
    return fail(messageOf(err));
  }
}
