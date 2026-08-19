// Every external fact in Avocore must carry provenance. Nothing is allowed to look
// like a verified fact without one of these classifications attached.

export type EvidenceClassification =
  | "VERIFIED" // confirmed via an authoritative/live source
  | "OBSERVED" // directly observed from a provider (live or mock) without independent confirmation
  | "ESTIMATED" // derived via a documented calculation from observed inputs
  | "INFERRED" // reasoned from patterns/signals, not a direct measurement
  | "MOCK"; // demo data — Phase 1 default for everything, since no live providers exist yet

export type DataType =
  | "demand"
  | "search_volume"
  | "trend"
  | "competition"
  | "review"
  | "complaint_signal"
  | "supplier"
  | "tariff"
  | "regulatory"
  | "shipping"
  | "marketplace_fee"
  | "advertising_cost"
  | "financial_calculation";

export interface Source {
  id: string;
  name: string; // e.g. "Mock Marketplace Provider", "Google Trends (mock)"
  url?: string; // reference URL if one exists (never fabricated)
  providerKey: string; // matches a key in the ProviderRegistry
}

export interface Evidence {
  id: string;
  dataType: DataType;
  classification: EvidenceClassification;
  claim: string; // human-readable statement this evidence supports
  value?: number | string | boolean;
  unit?: string;
  source: Source;
  collectedAt: string; // ISO timestamp
  freshnessNote?: string; // e.g. "mock data, generated at request time"
  confidence: number; // 0-100
  assumptions?: string[];
  // Real-provider provenance (Phase 2A). Optional so mock evidence (which predates
  // these fields) isn't required to have them — but any real-provider evidence MUST
  // set both, so a person can always answer "where did Avocore get this?"
  query?: string; // the exact input sent to the real source (search term, HTS code, etc.)
  rawReference?: string; // a URL or identifier pointing at the specific raw record, e.g. a recall number or HTS line
}

export const DATA_NOT_AVAILABLE = "DATA NOT AVAILABLE" as const;
