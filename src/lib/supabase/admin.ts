import { createClient } from "@supabase/supabase-js";

// Phase 1 has no user auth system, so this uses the public anon key rather than a
// service role key. Row Level Security policies on the database explicitly allow the
// anon role to read/write rows where user_id IS NULL (i.e. unowned demo runs), while
// still fully protecting any row that does have a real user_id. See the migration
// "allow_anon_access_for_unauthenticated_demo_runs" for the exact policies.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment."
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
