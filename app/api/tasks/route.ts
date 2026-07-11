import { z } from "zod";
import { submitTask } from "@/lib/pipeline";
import { fail, messageOf, ok } from "../_http";

export const dynamic = "force-dynamic";

const Body = z.object({
  companyId: z.string().min(1).max(64),
  title: z.string().min(1).max(300),
  input: z.string().min(1).max(12000),
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
  try {
    const result = await submitTask(parsed.data.companyId, parsed.data.title, parsed.data.input);
    return ok(result);
  } catch (err) {
    return fail(messageOf(err));
  }
}
