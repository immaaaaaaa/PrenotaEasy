import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. SERVER ONLY — never import into a client component.
 * Bypasses RLS, so every query must be scoped explicitly (e.g. by business).
 * Used for the public booking flow, which has no logged-in user.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
