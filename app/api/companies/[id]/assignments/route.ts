import { repos } from "@/lib/repos";
import type { AssignmentStatus } from "@/lib/db-types";
import { fail, messageOf, ok } from "../../../_http";

export const dynamic = "force-dynamic";

const STATUSES: AssignmentStatus[] = [
  "proposed",
  "awaiting_approval",
  "running",
  "completed",
  "rejected",
  "failed",
];

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const statusParam = new URL(req.url).searchParams.get("status");
  const status =
    statusParam && (STATUSES as string[]).includes(statusParam)
      ? (statusParam as AssignmentStatus)
      : undefined;
  try {
    const assignments = await repos.assignment.listByCompany(id, status);
    return ok(assignments);
  } catch (err) {
    return fail(messageOf(err));
  }
}
