import { ProviderRegistry } from "@/domain/provider";
import { AgentInput, AgentResult, Risk } from "@/domain/agent";

export async function runCompetitionAgent(
  providers: ProviderRegistry,
  input: AgentInput
): Promise<AgentResult> {
  const start = Date.now();
  const { candidate } = input;

  const listings = await providers.marketplace.searchListings(candidate.id, "US");

  const avgSellerCount = listings.reduce((s, l) => s + (l.sellerCount ?? 0), 0) / (listings.length || 1);
  const maxDominantShare = Math.max(...listings.map((l) => l.dominantBrandShare ?? 0));

  let competitionScore: number;
  let entryDifficulty: Risk["level"];
  if (avgSellerCount >= 80 || maxDominantShare >= 0.4) {
    competitionScore = 25;
    entryDifficulty = "HIGH";
  } else if (avgSellerCount >= 30 || maxDominantShare >= 0.25) {
    competitionScore = 50;
    entryDifficulty = "MEDIUM";
  } else {
    competitionScore = 78;
    entryDifficulty = "LOW";
  }

  const dominantBrandRisk = maxDominantShare >= 0.35;

  return {
    agent: "CompetitionAgent",
    candidateId: candidate.id,
    summary: `Observed ~${Math.round(
      avgSellerCount
    )} sellers on comparable listings; top brand(s) hold about ${(maxDominantShare * 100).toFixed(
      0
    )}% of reviews. ${dominantBrandRisk ? "Dominant-brand risk observed." : "No single dominant brand observed."}`,
    findings: {
      avgSellerCount: Math.round(avgSellerCount),
      dominantBrandShare: maxDominantShare,
      competitionScore,
      entryDifficulty,
      dominantBrandRisk,
    },
    evidence: listings,
    risk: { level: entryDifficulty, reasons: dominantBrandRisk ? ["Dominant brand risk"] : [] },
    confidence: 58,
    durationMs: Date.now() - start,
  };
}
