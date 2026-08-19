import { ProviderRegistry } from "@/domain/provider";
import { AgentInput, AgentResult } from "@/domain/agent";

export async function runAdvertisingEconomicsAgent(
  providers: ProviderRegistry,
  input: AgentInput
): Promise<AgentResult> {
  const start = Date.now();
  const { candidate } = input;

  const adCost = await providers.marketplace.estimateAdCost(candidate.id);

  const advertisingDependencyScore =
    adCost.dependencyLevel === "LOW"
      ? 85
      : adCost.dependencyLevel === "MEDIUM"
      ? 60
      : adCost.dependencyLevel === "HIGH"
      ? 30
      : 10; // EXTREME

  return {
    agent: "AdvertisingEconomicsAgent",
    candidateId: candidate.id,
    summary: `Estimated ACoS ${adCost.estimatedAcosPercent.toFixed(1)}%, classified as ${adCost.dependencyLevel} paid-traffic dependency.`,
    findings: {
      estimatedAcosPercent: adCost.estimatedAcosPercent,
      dependencyLevel: adCost.dependencyLevel,
      advertisingDependencyScore,
    },
    evidence: [adCost],
    risk: {
      level: adCost.dependencyLevel,
      reasons: adCost.dependencyLevel === "EXTREME" || adCost.dependencyLevel === "HIGH"
        ? ["High reliance on paid advertising to generate sales"]
        : [],
    },
    confidence: adCost.confidence,
    durationMs: Date.now() - start,
  };
}
