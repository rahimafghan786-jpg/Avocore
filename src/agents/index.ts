import { ProviderRegistry } from "@/domain/provider";
import { AgentInput, AgentResult, AgentName } from "@/domain/agent";
import { runDemandAgent } from "./demand-agent";
import { runCompetitionAgent } from "./competition-agent";
import { runReviewIntelligenceAgent } from "./review-agent";
import { runCustomerProblemAgent } from "./customer-problem-agent";
import { runProductImprovementAgent } from "./product-improvement-agent";
import { runSupplierAgent } from "./supplier-agent";
import { runFinancialAgent } from "./financial-agent";
import { runAdvertisingEconomicsAgent } from "./advertising-agent";
import { runRegulatoryRiskAgent } from "./regulatory-agent";
import { runCapitalProtectionAgent } from "./capital-protection-agent";

type AgentFn = (providers: ProviderRegistry, input: AgentInput) => Promise<AgentResult>;

// Agents that only need the raw request/candidate — safe to run fully in parallel.
export const INDEPENDENT_AGENTS: Record<string, AgentFn> = {
  DemandAgent: runDemandAgent,
  CompetitionAgent: runCompetitionAgent,
  ReviewIntelligenceAgent: runReviewIntelligenceAgent,
  CustomerProblemAgent: runCustomerProblemAgent,
  SupplierAgent: runSupplierAgent,
  FinancialAgent: runFinancialAgent,
  AdvertisingEconomicsAgent: runAdvertisingEconomicsAgent,
  RegulatoryRiskAgent: runRegulatoryRiskAgent,
};

// Agents that reason over other agents' already-computed findings (passed via
// `input.priorFindings`). Run after the independent agents finish.
export const DEPENDENT_AGENTS: Record<string, AgentFn> = {
  ProductImprovementAgent: runProductImprovementAgent,
  CapitalProtectionAgent: runCapitalProtectionAgent,
};

export const ALL_AGENT_NAMES: AgentName[] = [
  ...(Object.keys(INDEPENDENT_AGENTS) as AgentName[]),
  ...(Object.keys(DEPENDENT_AGENTS) as AgentName[]),
];
