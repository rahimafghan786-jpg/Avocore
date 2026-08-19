import { EvidenceClassification } from "@/domain/evidence";

const STYLES: Record<EvidenceClassification, { bg: string; fg: string; label: string }> = {
  VERIFIED: { bg: "var(--accent-green-dim)", fg: "var(--accent-green)", label: "Verified" },
  OBSERVED: { bg: "var(--accent-blue-dim)", fg: "var(--accent-blue)", label: "Observed" },
  ESTIMATED: { bg: "var(--accent-amber-dim)", fg: "var(--accent-amber)", label: "Estimated" },
  INFERRED: { bg: "var(--accent-purple-dim)", fg: "var(--accent-purple)", label: "Inferred" },
  MOCK: { bg: "var(--accent-gray-dim)", fg: "var(--accent-gray)", label: "Mock" },
};

export function EvidenceBadge({ classification }: { classification: EvidenceClassification }) {
  const style = STYLES[classification];
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {style.label}
    </span>
  );
}
