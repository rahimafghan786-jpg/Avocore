import { ProviderRegistry } from "@/domain/provider";
import { AgentInput, AgentResult } from "@/domain/agent";

export async function runSupplierAgent(
  providers: ProviderRegistry,
  input: AgentInput
): Promise<AgentResult> {
  const start = Date.now();
  const { candidate } = input;

  const suppliers = await providers.supplier.findSuppliers(candidate.id, candidate.supplierCountryHint);
  const cheapestAt500 = suppliers.reduce(
    (min, s) => (s.unitPriceAt500 < min ? s.unitPriceAt500 : min),
    Infinity
  );
  const anySampleVerified = suppliers.some((s) => s.verificationStatus === "SAMPLE_VERIFIED");
  const supplierConfidence = anySampleVerified ? 80 : suppliers.length >= 2 ? 45 : 25;

  return {
    agent: "SupplierAgent",
    candidateId: candidate.id,
    summary: `${suppliers.length} candidate suppliers found in ${candidate.supplierCountryHint}. Best observed price at 500 units: $${cheapestAt500.toFixed(
      2
    )}/unit. None sample-verified yet — treat pricing as preliminary.`,
    findings: {
      supplierCount: suppliers.length,
      bestUnitPriceAt500: cheapestAt500,
      supplierConfidence,
      anySampleVerified,
    },
    evidence: suppliers,
    confidence: supplierConfidence,
    durationMs: Date.now() - start,
  };
}
