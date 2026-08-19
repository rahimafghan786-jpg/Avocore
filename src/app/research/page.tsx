import Link from "next/link";
import { getAllCachedOpportunities } from "@/lib/master-agent";
import { DecisionBadge } from "@/components/DecisionBadge";

// Reads the live server-side research cache on every request — must not be statically
// prerendered at build time.
export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const opportunities = await getAllCachedOpportunities();

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-6 font-mono text-xs uppercase tracking-widest text-[var(--text-faint)]">
        Product Research
      </div>
      <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight">
        All investigated opportunities
      </h1>
      <p className="mb-8 max-w-2xl text-sm text-[var(--text-muted)]">
        Every candidate the Master Agent has researched across all runs this session, ranked by
        score within each decision bucket.
      </p>

      {opportunities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-subtle)] px-4 py-10 text-center">
          <div className="text-sm text-[var(--text-muted)]">No opportunities yet.</div>
          <Link href="/chat" className="mt-2 inline-block text-xs text-[var(--accent-amber)] hover:underline">
            Run a research request →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] text-left text-xs uppercase tracking-wide text-[var(--text-faint)]">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Capital required</th>
                <th className="px-4 py-3 font-medium">Difficulty</th>
                <th className="px-4 py-3 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((o) => (
                <tr key={o.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-surface)]">
                  <td className="px-4 py-3">
                    <Link href={`/opportunities/${o.id}`} className="font-medium hover:text-[var(--accent-amber)]">
                      {o.candidate.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{o.candidate.category}</td>
                  <td className="px-4 py-3 font-mono text-[var(--text-muted)]">{o.score.total}/100</td>
                  <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                    ${o.capitalRequired.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{o.beginnerDifficulty}</td>
                  <td className="px-4 py-3">
                    <DecisionBadge decision={o.decision} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
