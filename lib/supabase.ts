// Server-only Supabase client. Built from the SERVICE ROLE key, so it must
// never be imported into a Client Component or shipped to the browser — it
// bypasses row-level security by design.
//
// The client is created lazily and the required env vars are checked at CALL
// time (not import time), so `next build` and the test suite can load this
// module without live credentials.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Returns a memoized service-role Supabase client. Throws a clear error the
 * first time it is called if either SUPABASE_URL or
 * SUPABASE_SERVICE_ROLE_KEY is missing.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const missing = [
      !url ? "SUPABASE_URL" : null,
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Supabase server client requires ${missing} to be set in the environment.`,
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
