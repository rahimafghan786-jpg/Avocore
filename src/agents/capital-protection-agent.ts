import { ProviderRegistry } from "@/domain/provider";
import { AgentInput, AgentResult } from "@/domain/agent";

// Derives from FinancialAgent's already-computed output plus the user's stated budget.
// Attaches no new external evidence — its job is capital-fit reasoning, not data collection.
export async function runCapitalProtectionAgent(
  _providers: ProviderRegistry,
  input: AgentInput
): Promise<AgentResult> {
  const start = Date.now();
  const { candidate, request, priorFindings } = input;

  const financial = priorFindings?.FinancialAgent;
  const cashRequiredForTest = (financial?.findings.cashRequiredForTest as number) ?? undefined;
  const maxAffordableInventoryUnits = (financial?.findings.maxAffordableInventoryUnits as number) ?? undefined;

  let capitalEfficiencyScore = 50;
  let fitsCapital = true;
  const reasons: string[] = [];

  if (cashRequiredForTest !== undefined) {
    fitsCapital = cashRequiredForTest <= request.capital;
    if (!fitsCapital) {
      capitalEfficiencyScore = 15;
      reasons.push(
        `A minimum viable test (~$${cashRequiredForTest.toFixed(2)}) exceeds the stated available capital ($${request.capital.toFixed(
          2
        )}).`
      );
    } else {
      const utilizationPercent = (cashRequiredForTest / request.capital) * 100;
      if (utilizationPercent <= 25) capitalEfficiencyScore = 85;
      else if (utilizationPercent <= 50) capitalEfficiencyScore = 65;
      else capitalEfficiencyScore = 40;
      reasons.push(
        `A minimum viable test uses about ${utilizationPercent.toFixed(0)}% of the stated available capital.`
      );
    }
  }

  return {
    agent: "CapitalProtectionAgent",
    candidateId: candidate.id,
    summary: fitsCapital
      ? `This candidate fits within the user's stated $${request.capital.toFixed(2)} capital for a test batch.`
      : `This candidate's minimum test cost exceeds the user's stated $${request.capital.toFixed(2)} capital.`,
    findings: {
      fitsCapital,
      capitalEfficiencyScore,
      cashRequiredForTest,
      maxAffordableInventoryUnits,
      reasons,
    },
    evidence: financial?.evidence ?? [],
    confidence: financial ? 60 : 20,
    durationMs: Date.now() - start,
  };
}
