import { providerStatuses } from "@/providers/registry";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export default function SettingsPage() {
  const dbConnected = isSupabaseConfigured();
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-6 font-mono text-xs uppercase tracking-widest text-[var(--text-faint)]">
        Settings
      </div>
      <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight">Data Providers</h1>
      <p className="mb-8 max-w-xl text-sm text-[var(--text-muted)]">
        Every data source Avocore uses, and its real status. Nothing below is a &ldquo;Connect&rdquo;
        button that doesn&rsquo;t do anything — until a provider is genuinely wired to a live,
        authorized API, it stays marked Mock Data Active.
      </p>

      <div className="space-y-2">
        {providerStatuses.map((p) => (
          <div
            key={p.key}
            className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3"
          >
            <div>
              <div className="text-sm font-medium">{p.label}</div>
              <div className="text-xs text-[var(--text-faint)]">Planned: {p.plannedPhase}</div>
            </div>
            <span
              className="rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide"
              style={{
                backgroundColor: p.connected ? "var(--accent-green-dim)" : "var(--accent-gray-dim)",
                color: p.connected ? "var(--accent-green)" : "var(--accent-gray)",
              }}
            >
              {p.connected ? "Connected" : "Mock data active"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-sm font-medium">Database</div>
          <span
            className="rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide"
            style={{
              backgroundColor: dbConnected ? "var(--accent-green-dim)" : "var(--accent-gray-dim)",
              color: dbConnected ? "var(--accent-green)" : "var(--accent-gray)",
            }}
          >
            {dbConnected ? "Connected" : "Not connected"}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">
          {dbConnected ? (
            <>
              Research runs, opportunities, evidence, and scores persist to a live Supabase
              project (<code className="font-mono">supabase/migrations/0001_init.sql</code>).
              Since Phase 1 has no user login yet, rows write and read under permissive
              row-level-security policies scoped to unowned (no user) demo data — see the
              anon-access migration for the exact rules.
            </>
          ) : (
            <>
              The full schema is written and migration-ready (
              <code className="font-mono">supabase/migrations/0001_init.sql</code>), but no live
              Supabase project is connected in this environment. Research runs are currently
              persisted to a local JSON file on the server (
              <code className="font-mono">.avocore-data/runs.json</code>) instead — this is a
              fallback, not the intended production path. Set{" "}
              <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable it.
            </>
          )}
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <div className="mb-1 text-sm font-medium">AI narration</div>
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">
          If <code className="font-mono">ANTHROPIC_API_KEY</code> is set, Claude narrates already-computed
          results in plain English. It never invents evidence or numbers. Without a key, a
          deterministic summary template is used instead — the app works either way.
        </p>
      </div>
    </div>
  );
}
