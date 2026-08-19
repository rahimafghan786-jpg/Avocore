import { createBrowserClient } from "@supabase/ssr";

// Not yet connected to a live project in Phase 1 — env vars are placeholders until
// NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are set (see ROADMAP.md, Phase 1.5).
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "once a project is provisioned (see docs/ROADMAP.md, Phase 1.5)."
    );
  }
  return createBrowserClient(url, key);
}
