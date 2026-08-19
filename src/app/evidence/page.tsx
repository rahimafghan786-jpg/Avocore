"use client";

import { useMemo, useState } from "react";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import type { EvidenceClassification } from "@/domain/evidence";
import type { Opportunity } from "@/domain/opportunity";
import { useEffect } from "react";

const CLASSIFICATIONS: EvidenceClassification[] = ["VERIFIED", "OBSERVED", "ESTIMATED", "INFERRED", "MOCK"];

export default function EvidenceCenterPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [filter, setFilter] = useState<EvidenceClassification | "ALL">("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runs/latest-opportunities")
      .then(async (r) => {
        if (!r.ok) return [];
        const data = await r.json();
        return data.opportunities ?? [];
      })
      .catch(() => [])
      .then((opps) => {
        setOpportunities(opps);
        setLoading(false);
      });
  }, []);

  const allEvidence = useMemo(() => {
    const seen = new Map<string, { evidence: Opportunity["evidence"][number]; productName: string }>();
    for (const o of opportunities) {
      for (const e of o.evidence) {
        if (!seen.has(e.id)) seen.set(e.id, { evidence: e, productName: o.candidate.name });
      }
    }
    return [...seen.values()].filter((row) => filter === "ALL" || row.evidence.classification === filter);
  }, [opportunities, filter]);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-6 font-mono text-xs uppercase tracking-widest text-[var(--text-faint)]">
        Evidence Center
      </div>
      <h1 className="mb-2 font-display text-2xl font-semibold tracking-tight">
        Every claim, with its source
      </h1>
      <p className="mb-6 max-w-2xl text-sm text-[var(--text-muted)]">
        Nothing shown anywhere in Avocore is unlabeled. In Phase 1 everything is classified{" "}
        <span className="font-mono" style={{ color: "var(--accent-gray)" }}>
          MOCK
        </span>{" "}
        — generated from the seeded demo catalog, not a live source.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")} label="All" />
        {CLASSIFICATIONS.map((c) => (
          <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)} label={c} />
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text-faint)]">Loading…</div>
      ) : allEvidence.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-subtle)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
          No evidence yet — run a research request from AI Chat first.
        </div>
      ) : (
        <div className="space-y-2">
          {allEvidence.map(({ evidence: e, productName }) => (
            <div key={e.id} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
              <div className="mb-1.5 flex items-center gap-2">
                <EvidenceBadge classification={e.classification} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                  {e.dataType.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] text-[var(--text-faint)]">· {productName}</span>
                <span className="ml-auto font-mono text-[10px] text-[var(--text-faint)]">
                  {new Date(e.collectedAt).toLocaleString()}
                </span>
              </div>
              <div className="text-sm text-[var(--text-muted)]">{e.claim}</div>
              <div className="mt-1 text-[10px] text-[var(--text-faint)]">
                Source: {e.source.name} · Confidence {e.confidence}/100
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wide transition-colors"
      style={{
        borderColor: active ? "var(--accent-amber)" : "var(--border-subtle)",
        color: active ? "var(--accent-amber)" : "var(--text-muted)",
        backgroundColor: active ? "var(--accent-amber-dim)" : "transparent",
      }}
    >
      {label}
    </button>
  );
}
