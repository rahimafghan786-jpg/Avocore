// User Fit is a separate dimension from the raw opportunity score. Score answers
// "is this a good product, objectively?" User Fit answers "is this a good product
// FOR THIS USER, given their capital, experience, and stated risk tolerance?"
//
// The two are kept deliberately separate rather than blended into one number so the
// decision engine can apply User Fit as a hard-ish gate (a product that's genuinely
// excellent but far too complex for a total beginner should never silently become a
// GO just because the raw score is high) rather than letting it get averaged away.

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type RiskTolerance = "low" | "moderate" | "high";

// Tolerance thresholds per experience level. Documented and centralized here (not
// scattered across agents) specifically so Phase 2+ can tune these without hunting
// through agent code. See docs/SCORING.md "User Fit" section for the rationale.
export interface UserProfile {
  experienceLevel: ExperienceLevel;
  riskTolerance: RiskTolerance;
  capital: number;
  // 0-100: how much regulatory complexity this profile can absorb before it becomes
  // a blocker rather than a "proceed with caution."
  regulatoryTolerance: number;
  // 0-100: tolerance for operational complexity (import logistics, high MOQ, unverified
  // suppliers, multi-step fulfillment).
  complexityTolerance: number;
  // 0-100: tolerance for relying on paid advertising to generate sales.
  advertisingTolerance: number;
  // 0-100: tolerance for a crowded/competitive category.
  competitionTolerance: number;
  // Fraction (0-1) of available capital this profile should risk on a single first
  // test, before reserve. This is the "don't spend $1,900 of your $2,000" guardrail.
  safeCapitalAllocationPercent: number;
}

// Extracted directly from already-computed agent findings/evidence — no new agents,
// no new provider calls. This is a read of what the pipeline already knows.
export interface OpportunityComplexitySignals {
  regulatoryRiskScore: number; // 0-100, from RegulatoryRiskAgent
  advertisingDependencyLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  minObservedMoq: number | null; // smallest MOQ across candidate suppliers, if any
  anySupplierSampleVerified: boolean;
  freightTransitDays: number | null;
  avgSellerCount: number;
  dominantBrandShare: number;
  reviewComplaintFrequencyPercent: number; // proxy for return/support burden
}

export interface UserFitResult {
  userFitScore: number; // 0-100, weighted combination of the four sub-fits below
  profileFit: number; // 0-100 — is this product's complexity appropriate for this experience level
  capitalFit: number; // 0-100 — does this fit comfortably within a *safe* allocation, not just "can afford it"
  complexityFit: number; // 0-100 — MOQ, supplier verification, logistics complexity vs tolerance
  riskFit: number; // 0-100 — regulatory + competition + advertising risk vs stated risk tolerance
  recommendedTestAllocationPercent: number; // fraction of capital recommended for this specific test
  recommendedTestSize: number; // units
  recommendedTestBudget: number; // dollars
  recommendedReserve: number; // dollars held back
  capitalAtRiskPercent: number; // recommendedTestBudget / capital * 100
  notes: string[]; // human-readable reasons behind the sub-fit scores, for the memo/UI
}
