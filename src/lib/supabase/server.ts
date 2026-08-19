import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Not yet connected to a live project in Phase 1 — see src/lib/supabase/client.ts and
// docs/ROADMAP.md, Phase 1.5.
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "once a project is provisioned (see docs/ROADMAP.md, Phase 1.5)."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // setAll called from a Server Component — safe to ignore if middleware refreshes sessions.
        }
      },
    },
  });
}
