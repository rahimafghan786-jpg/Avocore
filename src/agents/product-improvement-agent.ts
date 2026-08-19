import { ProviderRegistry } from "@/domain/provider";
import { AgentInput, AgentResult } from "@/domain/agent";

// This agent does not call a provider directly — it reasons over the ReviewIntelligenceAgent
// and CustomerProblemAgent findings the Master Agent already computed. It attaches no new
// evidence of its own; it cites the evidence already gathered by those two agents.
export async function runProductImprovementAgent(
  _providers: ProviderRegistry,
  input: AgentInput
): Promise<AgentResult> {
  const start = Date.now();
  const { candidate, priorFindings } = input;

  const reviewFindings = priorFindings?.ReviewIntelligenceAgent;
  const problemFindings = priorFindings?.CustomerProblemAgent;

  const topComplaintTheme = (reviewFindings?.findings.topComplaintTheme as string) ?? "unknown";
  const unmetNeed = (problemFindings?.findings.unmetNeed as string) ?? "unknown";

  const differentiationIdeas: string[] = [];
  if (topComplaintTheme === "durability") differentiationIdeas.push("Use a reinforced material or thicker gauge at the stress point buyers report failing.");
  if (topComplaintTheme === "sizing") differentiationIdeas.push("Publish precise dimensions and a sizing guide; consider one additional size variant.");
  if (topComplaintTheme === "packaging") differentiationIdeas.push("Add a rigid insert/mailer box to prevent transit damage.");
  if (topComplaintTheme === "usability") differentiationIdeas.push("Include a one-page quick-start card in the box, not just a QR code.");
  if (topComplaintTheme === "shipping_damage") differentiationIdeas.push("Upgrade outer packaging and add corner protection.");
  if (topComplaintTheme === "value_perception") differentiationIdeas.push("Bundle a small accessory to shift the value comparison instead of competing purely on price.");
  if (topComplaintTheme === "feature_request") differentiationIdeas.push("Add the most-requested feature as a variant, and price it as an upsell.");
  if (differentiationIdeas.length === 0) {
    differentiationIdeas.push("No strong, evidence-backed differentiation angle identified yet — treat as a research gap, not a green light.");
  }

  const differentiationPotentialScore = differentiationIdeas.length > 0 && topComplaintTheme !== "unknown" ? 65 : 30;

  return {
    agent: "ProductImprovementAgent",
    candidateId: candidate.id,
    summary: `Based on the "${topComplaintTheme}" complaint pattern and the unmet need "${unmetNeed}", the clearest differentiation angle is: ${differentiationIdeas[0]}`,
    findings: {
      topComplaintTheme,
      unmetNeed,
      differentiationIdeas,
      differentiationPotentialScore,
    },
    evidence: [...(reviewFindings?.evidence ?? []), ...(problemFindings?.evidence ?? [])],
    confidence: reviewFindings && problemFindings ? 55 : 25,
    durationMs: Date.now() - start,
  };
}
