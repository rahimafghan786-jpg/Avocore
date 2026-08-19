import { TrendProvider, TrendResult } from "@/domain/provider";
import { getCandidateById } from "./seed-data";
import { seededRandom, pick } from "./seeded-random";
import { makeSource, makeEvidence } from "./evidence-helpers";

export class MockTrendProvider implements TrendProvider {
  async getTrend(term: string, market: "US"): Promise<TrendResult> {
    const candidate = getCandidateById(term);
    const profile = candidate?.mockProfile ?? "solid_beginner";
    const rand = seededRandom(`trend-${term}-${market}`);
    const source = makeSource("trend", "Mock Trend Provider");

    const trendType =
      profile === "trap_saturation"
        ? "established"
        : profile === "underserved_niche"
        ? pick(rand, ["emerging", "established"] as const)
        : pick(rand, ["established", "seasonal"] as const);

    return {
      ...makeEvidence({
        dataType: "trend",
        claim: `Interest trend for "${candidate?.name ?? term}" is classified as ${trendType}.`,
        value: trendType,
        source,
        confidence: 50,
        assumptions: ["Mock trend classification, not sourced from a live trends API."],
      }),
      classification: "MOCK",
      term: candidate?.name ?? term,
      trendType,
    };
  }
}
