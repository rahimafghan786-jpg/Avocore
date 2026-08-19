import { AgentResult, AgentName } from "@/domain/agent";
import { OpportunityScore, ScoreComponent } from "@/domain/opportunity";

type FindingsByAgent = Partial<Record<AgentName, AgentResult>>;

// Weights sum to 1.0. Configurable here, and always shown in full in the UI — never hidden.
export const SCORE_WEIGHTS: Record<ScoreComponent["key"], number> = {
  demandQuality: 0.2,
  demandGrowth: 0.1,
  competition: 0.15,
  marginPotential: 0.15,
  manufacturingFeasibility: 0.1,
  supplyAvailability: 0.1,
  advertisingDependency: 0.05,
  regulatoryRisk: 0.05,
  capitalEfficiency: 0.05,
  differentiationPotential: 0.05,
};

const LABELS: Record<ScoreComponent["key"], string> = {
  demandQuality: "Demand Quality",
  demandGrowth: "Demand Growth",
  competition: "Competition",
  marginPotential: "Margin Potential",
  manufacturingFeasibility: "Manufacturing/Sourcing Feasibility",
  supplyAvailability: "Supply Availability",
  advertisingDependency: "Advertising Dependency",
  regulatoryRisk: "Regulatory Risk",
  capitalEfficiency: "Capital Efficiency",
  differentiationPotential: "Differentiation Potential",
};

function indexByAgent(results: AgentResult[]): FindingsByAgent {
  const map: FindingsByAgent = {};
  for (const r of results) map[r.agent] = r;
  return map;
}

export function computeScore(agentResults: AgentResult[]): OpportunityScore {
  const byAgent = indexByAgent(agentResults);

  const raw: Record<ScoreComponent["key"], number> = {
    demandQuality: (byAgent.DemandAgent?.findings.demandQualityScore as number) ?? 0,
    demandGrowth: (byAgent.DemandAgent?.findings.demandGrowthScore as number) ?? 0,
    competition: (byAgent.CompetitionAgent?.findings.competitionScore as number) ?? 0,
    marginPotential: (byAgent.FinancialAgent?.findings.marginPotentialScore as number) ?? 0,
    // No dedicated manufacturing-feasibility agent in Phase 1 — approximated from supplier
    // lead time / verification maturity via SupplierAgent, and explicitly lower-confidence.
    manufacturingFeasibility: byAgent.SupplierAgent
      ? Math.min(70, (byAgent.SupplierAgent.findings.supplierConfidence as number) + 15)
      : 0,
    supplyAvailability: byAgent.SupplierAgent
      ? Math.min(90, ((byAgent.SupplierAgent.findings.supplierCount as number) ?? 0) * 20)
      : 0,
    advertisingDependency: (byAgent.AdvertisingEconomicsAgent?.findings.advertisingDependencyScore as number) ?? 0,
    regulatoryRisk: byAgent.RegulatoryRiskAgent
      ? 100 - (byAgent.RegulatoryRiskAgent.findings.riskScore as number)
      : 50,
    capitalEfficiency: (byAgent.CapitalProtectionAgent?.findings.capitalEfficiencyScore as number) ?? 0,
    differentiationPotential: (byAgent.ProductImprovementAgent?.findings.differentiationPotentialScore as number) ?? 0,
  };

  const components: ScoreComponent[] = (Object.keys(SCORE_WEIGHTS) as ScoreComponent["key"][]).map((key) => {
    const weight = SCORE_WEIGHTS[key];
    const rawScore = Math.max(0, Math.min(100, raw[key]));
    return {
      key,
      label: LABELS[key],
      weight,
      rawScore,
      weightedContribution: Math.round(rawScore * weight * 100) / 100,
    };
  });

  const total = Math.round(components.reduce((s, c) => s + c.weightedContribution, 0));

  const dataConfidence = averageConfidence(agentResults);
  const profitConfidence = byAgent.FinancialAgent?.confidence ?? 0;
  const supplierConfidence = (byAgent.SupplierAgent?.findings.supplierConfidence as number) ?? 0;
  const regulatoryConfidence = byAgent.RegulatoryRiskAgent?.confidence ?? 0;

  return {
    total,
    components,
    dataConfidence,
    profitConfidence,
    supplierConfidence,
    regulatoryConfidence,
  };
}

function averageConfidence(results: AgentResult[]): number {
  if (results.length === 0) return 0;
  return Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length);
}
