import { ProviderRegistry } from "@/domain/provider";
import { AgentInput, AgentResult } from "@/domain/agent";

export async function runCustomerProblemAgent(
  providers: ProviderRegistry,
  input: AgentInput
): Promise<AgentResult> {
  const start = Date.now();
  const { candidate } = input;

  const signals = await providers.social.getComplaintSignals(candidate.id);
  const frequent = signals.filter((s) => s.frequency === "frequent");

  const unmetNeed =
    frequent.length > 0
      ? frequent[0].complaintText
      : signals[0]?.complaintText ?? "No strong unmet-need signal observed in sampled data.";

  return {
    agent: "CustomerProblemAgent",
    candidateId: candidate.id,
    summary: `${signals.length} public complaint-pattern signals sampled; ${frequent.length} rated "frequent". Clearest unmet need: "${unmetNeed}"`,
    findings: {
      signalCount: signals.length,
      frequentCount: frequent.length,
      unmetNeed,
    },
    evidence: signals,
    confidence: 42,
    durationMs: Date.now() - start,
  };
}
