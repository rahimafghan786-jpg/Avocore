import { Evidence } from "./evidence";
import { AgentResult, ActionPlan, RiskLevel } from "./agent";
import { FinancialOutputs } from "./financial";
import { UserFitResult, ExperienceLevel, RiskTolerance } from "./user-fit";

export type Decision = "GO" | "TEST" | "INVESTIGATE" | "WAIT" | "REJECT";

export interface ScoreComponent {
  key:
    | "demandQuality"
    | "demandGrowth"
    | "competition"
    | "marginPotential"
    | "manufacturingFeasibility"
    | "supplyAvailability"
    | "advertisingDependency"
    | "regulatoryRisk"
    | "capitalEfficiency"
    | "differentiationPotential";
  label: string;
  weight: number; // 0-1, sums to 1 across all components
  rawScore: number; // 0-100
  weightedContribution: number; // rawScore * weight
}

export interface OpportunityScore {
  total: number; // 0-100
  components: ScoreComponent[];
  dataConfidence: number;
  profitConfidence: number;
  supplierConfidence: number;
  regulatoryConfidence: number;
}

export type ContradictionSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface ContradictionFinding {
  id: string;
  // Machine-readable type slug, e.g. "SATURATION", "WEAK_DEMAND", "LANDED_COST_TRAP".
  type: string;
  severity: ContradictionSeverity;
  // Kept for backward compatibility with existing UI code and the DB column
  // `pattern_matched` — same value as `type`, lowercased with underscores.
  patternMatched: string;
  narrative: string;
  // Short summary of which evidence/findings triggered this — for the UI/memo, not
  // a re-derivation, just a pointer back to what was already computed.
  evidenceSummary: string;
  affectedMetrics: string[];
  recommendedAction: string;
  forcesDecision?: Decision;
  capsDecision?: Decision;
}

export type MockProfile =
  | "solid_beginner"
  | "underserved_niche"
  | "trap_saturation"
  | "trap_ad_dependency"
  | "trap_regulatory"
  | "trap_landed_cost";

export interface CandidateProduct {
  id: string;
  name: string;
  category: string;
  problemSolved: string;
  targetCustomer: string;
  supplierCountryHint: string;
  basePriceHint: number;
  unitWeightKgHint: number;
  // Used only by mock providers to shape realistic, internally-consistent demo evidence.
  // Never read by agents/engines directly, and never exposed as a "real" signal in the UI.
  mockProfile: MockProfile;
}

export interface Opportunity {
  id: string;
  runId: string;
  candidate: CandidateProduct;
  targetMarket: "US";
  marketplaceRecommendation: string;
  agentResults: AgentResult[];
  evidence: Evidence[];
  contradictions: ContradictionFinding[];
  financials: FinancialOutputs;
  score: OpportunityScore;
  decision: Decision;
  decisionNarrative: string;
  actionPlan: ActionPlan;
  beginnerDifficulty: RiskLevel;
  capitalRequired: number;
  userFit: UserFitResult;
  createdAt: string;
}

export interface ResearchRequest {
  capital: number;
  market: "US";
  experienceLevel: ExperienceLevel;
  riskTolerance: RiskTolerance;
  requestedCount: number;
  rawMessage: string;
}

export interface ResearchRun {
  id: string;
  request: ResearchRequest;
  opportunities: Opportunity[];
  createdAt: string;
  narrative: string;
}
