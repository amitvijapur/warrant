import { repos } from "@/lib/repos";
import { fail, messageOf, ok } from "../_http";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const companies = await repos.company.list();
    return ok(companies);
  } catch (err) {
    return fail(messageOf(err));
  }
}
