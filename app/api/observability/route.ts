// Non-secret integration status for the Observability tab. Booleans, a
// non-secret host, and model ids only — never a key or token value. The
// Langfuse "enabled" check mirrors lib/substrate.ts's isLangfuseEnabled()
// without importing the server-only Langfuse client into this route.

import { fail, ok } from "../_http";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const langfuseEnabled =
      process.env.LANGFUSE_ENABLED === "true" &&
      !!process.env.LANGFUSE_PUBLIC_KEY &&
      !!process.env.LANGFUSE_SECRET_KEY;

    return ok({
      langfuse: {
        enabled: langfuseEnabled,
        host: process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
      },
      openai: {
        classifier: process.env.CLASSIFIER_MODEL ?? "gpt-4o-mini",
        judge: process.env.JUDGE_MODEL ?? "gpt-4o",
        design: process.env.DESIGN_MODEL ?? "gpt-4o",
      },
      supabase: {
        configured: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      netlify: {
        hosting: true,
      },
    });
  } catch {
    return fail("could not resolve observability status");
  }
}
