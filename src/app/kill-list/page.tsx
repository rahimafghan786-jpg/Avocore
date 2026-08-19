import Link from "next/link";
import { getKillListFromCache } from "@/lib/master-agent";

// Reads the live server-side research cache on every request — must not be statically
// prerendered at build time.
export const dynamic = "force-dynamic";

export default async function KillListPage() {
  const rejected = await getKillListFromCache();

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-6 font-mono text-xs uppercase tracking-widest text-[var(--text-faint)]">
        Kill List
      </div>
      <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight">
        Opportunities to avoid
      </h1>
      <p className="mb-8 max-w-2xl text-sm text-[var(--text-muted)]">
        Rejected candidates, with the specific reasoning. Don&rsquo;t revisit these without new
        evidence that changes the underlying picture.
      </p>

      {rejected.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-subtle)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
          Nothing rejected yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rejected.map((o) => (
            <div key={o.id} className="rounded-lg border border-[var(--accent-red-dim)] bg-[var(--bg-surface)] p-4">
              <div className="mb-1 flex items-center justify-between">
                <Link href={`/opportunities/${o.id}`} className="font-medium text-sm hover:text-[var(--accent-amber)]">
                  {o.candidate.name}
                </Link>
                <span className="font-mono text-xs text-[var(--text-faint)]">score {o.score.total}/100</span>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">{o.decisionNarrative}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
