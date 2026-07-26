import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client - the ONLY writer in the system (RLS denies
// all client-side writes). Never import from a client component.
let cached: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set",
    );
  }
  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cached;
}
