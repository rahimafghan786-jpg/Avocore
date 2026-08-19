import { Evidence } from "./evidence";
import { CandidateProduct, ResearchRequest } from "./opportunity";

export interface AgentInput {
  candidate: CandidateProduct;
  request: ResearchRequest;
  // Populated by the Master Agent once FinancialAgent has run, so downstream agents
  // (e.g. CapitalProtectionAgent) can reason over computed economics without recomputing them.
  priorFindings?: Partial<Record<AgentName, AgentResult>>;
}

export type AgentName =
  | "DemandAgent"
  | "CompetitionAgent"
  | "ReviewIntelligenceAgent"
  | "CustomerProblemAgent"
  | "ProductImprovementAgent"
  | "SupplierAgent"
  | "FinancialAgent"
  | "AdvertisingEconomicsAgent"
  | "RegulatoryRiskAgent"
  | "CapitalProtectionAgent";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export interface Risk {
  level: RiskLevel;
  reasons: string[];
}

export interface AgentResult {
  agent: AgentName;
  candidateId: string;
  summary: string;
  findings: Record<string, unknown>;
  evidence: Evidence[];
  risk?: Risk;
  confidence: number; // 0-100
  durationMs: number;
}

export interface ActionPlan {
  action: "GO" | "TEST" | "INVESTIGATE" | "WAIT" | "REJECT";
  testQuantity?: number;
  testBudget?: number;
  targetPrice?: number;
  targetMargin?: number;
  successCriteria?: string[];
  failureCriteria?: string[];
  nextSteps: string[];
}
