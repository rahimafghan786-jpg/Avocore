import Link from "next/link";
import { getLatestRunFromCache, getKillListFromCache } from "@/lib/master-agent";
import { DecisionBadge } from "@/components/DecisionBadge";

// This page reads the live server-side research cache on every request, so it must not be
// statically prerendered at build time (which would freeze it at "no data yet" forever).
export const dynamic = "force-dynamic";

export default async function CommandCenter() {
  const run = await getLatestRunFromCache();
  const killList = await getKillListFromCache();

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="mb-10">
        <div className="font-mono text-xs uppercase tracking-widest text-[var(--text-faint)]">
          Command Center
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Avocore
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
          Ask what to sell, evaluate whether an idea is worth testing, or review the reasoning
          behind past opportunities. Every number below is labeled with where it came from —
          nothing here is presented as guaranteed.
        </p>
      </header>

      <div className="mb-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <div className="mb-3 font-display text-sm font-medium">Start a research request</div>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          Try: &ldquo;I have $2,000. I live in the USA. I have no e-commerce experience. Find me
          five product opportunities.&rdquo;
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center rounded-md px-4 py-2 font-display text-sm font-semibold"
          style={{ backgroundColor: "var(--accent-amber)", color: "#14100a" }}
        >
          Open AI Chat →
        </Link>
      </div>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Most recent research run
          </h2>
          {run && (
            <Link href="/research" className="text-xs text-[var(--accent-amber)] hover:underline">
              View all opportunities →
            </Link>
          )}
        </div>

        {!run ? (
          <EmptyState
            title="No research run yet"
            body="Run a request from AI Chat to see opportunities here."
          />
        ) : (
          <div className="space-y-2">
            {run.opportunities.map((o) => (
              <Link
                key={o.id}
                href={`/opportunities/${o.id}`}
                className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 transition-colors hover:border-[var(--border-strong)]"
              >
                <div>
                  <div className="font-medium text-sm">{o.candidate.name}</div>
                  <div className="text-xs text-[var(--text-faint)]">{o.candidate.category}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-[var(--text-muted)]">{o.score.total}/100</span>
                  <DecisionBadge decision={o.decision} size="sm" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Kill list
          </h2>
          {killList.length > 0 && (
            <Link href="/kill-list" className="text-xs text-[var(--accent-amber)] hover:underline">
              View reasons →
            </Link>
          )}
        </div>
        {killList.length === 0 ? (
          <EmptyState title="Nothing rejected yet" body="Rejected opportunities and why will show up here." />
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            {killList.length} opportunit{killList.length === 1 ? "y" : "ies"} currently rejected —
            see the Kill List for reasoning.
          </p>
        )}
      </section>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center">
      <div className="text-sm text-[var(--text-muted)]">{title}</div>
      <div className="mt-1 text-xs text-[var(--text-faint)]">{body}</div>
    </div>
  );
}
