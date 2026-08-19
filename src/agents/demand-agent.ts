import { ProviderRegistry } from "@/domain/provider";
import { AgentInput, AgentResult } from "@/domain/agent";

export async function runDemandAgent(
  providers: ProviderRegistry,
  input: AgentInput
): Promise<AgentResult> {
  const start = Date.now();
  const { candidate } = input;

  const [listings, searchVolume, trend] = await Promise.all([
    providers.marketplace.searchListings(candidate.id, "US"),
    providers.search.getSearchVolume(candidate.id, "US"),
    providers.trend.getTrend(candidate.id, "US"),
  ]);

  const avgMonthlySales =
    listings.reduce((sum, l) => sum + (l.estimatedMonthlySales ?? 0), 0) / (listings.length || 1);

  let demandQualityScore: number;
  if (avgMonthlySales >= 600) demandQualityScore = 85;
  else if (avgMonthlySales >= 300) demandQualityScore = 68;
  else if (avgMonthlySales >= 150) demandQualityScore = 52;
  else demandQualityScore = 35;

  let demandGrowthScore = 50;
  if (searchVolume.trendDirection === "rising") demandGrowthScore += 20;
  if (searchVolume.trendDirection === "declining") demandGrowthScore -= 20;
  if (trend.trendType === "emerging") demandGrowthScore += 15;
  if (trend.trendType === "declining" || trend.trendType === "noise") demandGrowthScore -= 15;
  demandGrowthScore = Math.max(0, Math.min(100, demandGrowthScore));

  const evidence = [...listings, searchVolume, trend];

  return {
    agent: "DemandAgent",
    candidateId: candidate.id,
    summary: `Average comparable-listing demand is ~${Math.round(
      avgMonthlySales
    )} units/month; search trend is ${searchVolume.trendDirection}, interest trend ${trend.trendType}.`,
    findings: {
      avgMonthlySales: Math.round(avgMonthlySales),
      searchVolume: searchVolume.monthlySearchVolume,
      trendDirection: searchVolume.trendDirection,
      trendType: trend.trendType,
      demandQualityScore,
      demandGrowthScore,
    },
    evidence,
    confidence: 60,
    durationMs: Date.now() - start,
  };
}
