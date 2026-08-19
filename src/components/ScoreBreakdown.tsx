import { OpportunityScore } from "@/domain/opportunity";

export function ScoreBreakdown({ score }: { score: OpportunityScore }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-display text-xs uppercase tracking-widest text-[var(--text-faint)]">
          Opportunity Score
        </span>
        <span className="font-mono text-2xl font-medium" style={{ color: "var(--accent-amber)" }}>
          {score.total}
          <span className="text-sm text-[var(--text-faint)]">/100</span>
        </span>
      </div>

      <div className="space-y-1.5">
        {score.components.map((c) => (
          <div key={c.key} className="flex items-center gap-2">
            <span className="w-44 shrink-0 text-xs text-[var(--text-muted)]">{c.label}</span>
            <div className="h-1.5 flex-1 rounded-full bg-[var(--bg-surface-raised)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${c.rawScore}%`,
                  backgroundColor: "var(--accent-amber)",
                  opacity: 0.35 + (c.weight / 0.2) * 0.5,
                }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-xs text-[var(--text-muted)]">
              {c.rawScore}
              <span className="text-[var(--text-faint)]"> ×{Math.round(c.weight * 100)}%</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ConfidencePill label="Data" value={score.dataConfidence} />
        <ConfidencePill label="Profit" value={score.profitConfidence} />
        <ConfidencePill label="Supplier" value={score.supplierConfidence} />
        <ConfidencePill label="Regulatory" value={score.regulatoryConfidence} />
      </div>
    </div>
  );
}

function ConfidencePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label} confidence</div>
      <div className="font-mono text-sm text-[var(--text-primary)]">{value}/100</div>
    </div>
  );
}
