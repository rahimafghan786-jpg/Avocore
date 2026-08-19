import Link from "next/link";
import { notFound } from "next/navigation";
import { getOpportunityFromCache } from "@/lib/master-agent";
import { DecisionBadge } from "@/components/DecisionBadge";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const o = await getOpportunityFromCache(id);
  if (!o) notFound();

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <Link href="/research" className="mb-6 inline-block text-xs text-[var(--text-faint)] hover:text-[var(--accent-amber)]">
        ← All opportunities
      </Link>

      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[var(--text-faint)]">
            {o.candidate.category} · {o.targetMarket}
          </div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{o.candidate.name}</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--text-muted)]">{o.candidate.problemSolved}</p>
        </div>
        <DecisionBadge decision={o.decision} />
      </div>

      <section className="mb-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <div className="mb-2 font-display text-sm font-medium">Why</div>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">{o.decisionNarrative}</p>
        {o.contradictions.length > 0 && (
          <div className="mt-4 space-y-2.5 border-t border-[var(--border-subtle)] pt-4">
            <div className="text-xs uppercase tracking-wide text-[var(--text-faint)]">
              Contradiction check
            </div>
            {o.contradictions.map((c) => {
              const severityStyle =
                c.severity === "CRITICAL"
                  ? { bg: "var(--accent-red-dim)", fg: "var(--accent-red)" }
                  : c.severity === "HIGH"
                  ? { bg: "var(--accent-amber-dim)", fg: "var(--accent-amber)" }
                  : c.severity === "MEDIUM"
                  ? { bg: "var(--accent-blue-dim)", fg: "var(--accent-blue)" }
                  : { bg: "var(--accent-gray-dim)", fg: "var(--accent-gray)" };
              return (
                <div
                  key={c.id}
                  className="rounded-md border px-3 py-2"
                  style={{ borderColor: severityStyle.fg + "40" }}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
                      style={{ backgroundColor: severityStyle.bg, color: severityStyle.fg }}
                    >
                      {c.severity}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                      {c.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">{c.narrative}</div>
                  {c.recommendedAction && (
                    <div className="mt-1 text-[11px] italic text-[var(--text-faint)]">
                      → {c.recommendedAction}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <ScoreBreakdown score={o.score} />
      </section>

      <section className="mb-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-display text-xs uppercase tracking-widest text-[var(--text-faint)]">
            User Fit — for this specific profile
          </span>
          <span className="font-mono text-2xl font-medium" style={{ color: "var(--accent-blue)" }}>
            {o.userFit.userFitScore}
            <span className="text-sm text-[var(--text-faint)]">/100</span>
          </span>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <FitPill label="Profile" value={o.userFit.profileFit} />
          <FitPill label="Capital" value={o.userFit.capitalFit} />
          <FitPill label="Complexity" value={o.userFit.complexityFit} />
          <FitPill label="Risk" value={o.userFit.riskFit} />
        </div>
        <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2.5">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
            Capital plan
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Recommended test: <span className="font-mono text-[var(--text-primary)]">{o.userFit.recommendedTestSize} units / ${o.userFit.recommendedTestBudget.toFixed(2)}</span>
            {" · "}Reserve: <span className="font-mono text-[var(--text-primary)]">${o.userFit.recommendedReserve.toFixed(2)}</span>
            {" · "}Capital at risk: <span className="font-mono text-[var(--text-primary)]">{o.userFit.capitalAtRiskPercent.toFixed(1)}%</span>
          </div>
        </div>
        {o.userFit.notes.length > 0 && (
          <ul className="mt-3 space-y-1 text-[11px] text-[var(--text-faint)]">
            {o.userFit.notes.map((n, i) => (
              <li key={i}>• {n}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Capital required" value={`$${o.capitalRequired.toFixed(2)}`} />
        <Stat label="Margin" value={`${o.financials.contributionMarginPercent?.toFixed(1) ?? "—"}%`} />
        <Stat label="Landed cost/unit" value={`$${o.financials.landedCostPerUnit?.toFixed(2) ?? "—"}`} />
        <Stat label="Beginner difficulty" value={o.beginnerDifficulty} />
        <Stat label="Target customer" value={o.candidate.targetCustomer} small />
        <Stat label="Marketplace" value={o.marketplaceRecommendation} small />
      </section>

      <section className="mb-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <div className="mb-3 font-display text-sm font-medium">Next steps</div>
        <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
          {o.actionPlan.nextSteps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-[var(--text-faint)]">{String(i + 1).padStart(2, "0")}</span>
              {step}
            </li>
          ))}
        </ul>
        {o.actionPlan.successCriteria && (
          <div className="mt-4 grid gap-4 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wide" style={{ color: "var(--accent-green)" }}>
                Success criteria
              </div>
              <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                {o.actionPlan.successCriteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wide" style={{ color: "var(--accent-red)" }}>
                Failure criteria
              </div>
              <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                {o.actionPlan.failureCriteria?.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display text-sm font-medium">Evidence trail ({o.evidence.length})</div>
          <Link href="/evidence" className="text-xs text-[var(--accent-amber)] hover:underline">
            Evidence Center →
          </Link>
        </div>
        <div className="space-y-2">
          {o.evidence.slice(0, 12).map((e) => (
            <div key={e.id} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
              <div className="mb-1 flex items-center gap-2">
                <EvidenceBadge classification={e.classification} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                  {e.dataType.replace(/_/g, " ")}
                </span>
                <span className="ml-auto font-mono text-[10px] text-[var(--text-faint)]">
                  confidence {e.confidence}
                </span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">{e.claim}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className={small ? "mt-1 text-sm text-[var(--text-primary)]" : "mt-1 font-mono text-lg text-[var(--text-primary)]"}>
        {value}
      </div>
    </div>
  );
}

function FitPill({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "var(--accent-green)" : value >= 40 ? "var(--accent-amber)" : "var(--accent-red)";
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label} fit</div>
      <div className="font-mono text-sm" style={{ color }}>{value}/100</div>
    </div>
  );
}
