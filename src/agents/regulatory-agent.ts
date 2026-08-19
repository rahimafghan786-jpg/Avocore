import { ProviderRegistry } from "@/domain/provider";
import { AgentInput, AgentResult } from "@/domain/agent";

export async function runRegulatoryRiskAgent(
  providers: ProviderRegistry,
  input: AgentInput
): Promise<AgentResult> {
  const start = Date.now();
  const { candidate } = input;

  const assessment = await providers.regulatory.assessCategory(candidate.category, candidate.name);

  return {
    agent: "RegulatoryRiskAgent",
    candidateId: candidate.id,
    summary: assessment.requiresStopAndVerify
      ? `Regulatory complexity detected for "${candidate.category}" — STOP AND VERIFY with a qualified professional before sourcing.`
      : `No major regulatory red flags detected for "${candidate.category}" in this screen.`,
    findings: {
      category: candidate.category,
      riskScore: assessment.riskScore,
      requiredAgencies: assessment.requiredAgencies,
      requiresStopAndVerify: assessment.requiresStopAndVerify,
    },
    evidence: [assessment],
    risk: {
      level: assessment.requiresStopAndVerify ? "HIGH" : "LOW",
      reasons: assessment.requiredAgencies,
    },
    confidence: assessment.confidence,
    durationMs: Date.now() - start,
  };
}
