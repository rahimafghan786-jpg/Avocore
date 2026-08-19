import { SearchProvider, SearchVolumeResult } from "@/domain/provider";
import { getCandidateById } from "./seed-data";
import { seededRandom, randInt, pick } from "./seeded-random";
import { makeSource, makeEvidence } from "./evidence-helpers";

export class MockSearchProvider implements SearchProvider {
  async getSearchVolume(term: string, market: "US"): Promise<SearchVolumeResult> {
    const candidate = getCandidateById(term);
    const profile = candidate?.mockProfile ?? "solid_beginner";
    const rand = seededRandom(`search-volume-${term}-${market}`);
    const source = makeSource("search", "Mock Search Volume Provider");

    const base =
      profile === "trap_saturation" || profile === "trap_ad_dependency"
        ? randInt(rand, 18000, 60000)
        : profile === "underserved_niche"
        ? randInt(rand, 1200, 6000)
        : randInt(rand, 4000, 14000);

    const trendDirection = pick(rand, ["rising", "flat", "declining"] as const);

    return {
      ...makeEvidence({
        dataType: "search_volume",
        claim: `Estimated monthly US search volume for terms related to "${
          candidate?.name ?? term
        }" is about ${base.toLocaleString()}, trend direction ${trendDirection}.`,
        value: base,
        unit: "searches/month",
        source,
        confidence: 58,
        assumptions: ["Mock keyword-cluster estimate, not a live Search Console/Ads figure."],
      }),
      term: candidate?.name ?? term,
      monthlySearchVolume: base,
      trendDirection,
    };
  }
}
