import { ProviderRegistry } from "@/domain/provider";
import { AgentInput, AgentResult } from "@/domain/agent";

export async function runReviewIntelligenceAgent(
  providers: ProviderRegistry,
  input: AgentInput
): Promise<AgentResult> {
  const start = Date.now();
  const { candidate } = input;

  const listings = await providers.marketplace.searchListings(candidate.id, "US");
  const topListing = listings[0];
  const reviews = topListing ? await providers.marketplace.getListingReviews(topListing.listingId) : [];

  const negative = reviews.filter((r) => r.rating <= 3);
  const themeCounts = new Map<string, number>();
  for (const r of negative) {
    themeCounts.set(r.theme, (themeCounts.get(r.theme) ?? 0) + 1);
  }
  const sortedThemes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topComplaintTheme = sortedThemes[0]?.[0] ?? "none observed";
  const complaintFrequency = negative.length / (reviews.length || 1);

  return {
    agent: "ReviewIntelligenceAgent",
    candidateId: candidate.id,
    summary: `${negative.length} of ${reviews.length} sampled reviews were 3 stars or below. Top recurring complaint theme: ${topComplaintTheme}.`,
    findings: {
      sampleSize: reviews.length,
      negativeCount: negative.length,
      complaintFrequency: Math.round(complaintFrequency * 100),
      topComplaintTheme,
      themeCounts: Object.fromEntries(sortedThemes),
    },
    evidence: reviews,
    confidence: 50,
    durationMs: Date.now() - start,
  };
}
