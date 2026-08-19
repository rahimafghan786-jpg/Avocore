import {
  MarketplaceProvider,
  ListingResult,
  ReviewResult,
  FeeEstimate,
  AdCostEstimate,
} from "@/domain/provider";
import { getCandidateById } from "./seed-data";
import { seededRandom, randInt, randFloat, pick } from "./seeded-random";
import { makeSource, makeEvidence } from "./evidence-helpers";

const SOURCE_NAME = "Mock Marketplace Provider";

function profileDemandRange(profile: string): [number, number] {
  switch (profile) {
    case "trap_saturation":
    case "trap_ad_dependency":
    case "trap_landed_cost":
      return [700, 2000];
    case "solid_beginner":
      return [300, 650];
    case "underserved_niche":
      return [130, 350];
    case "trap_regulatory":
      return [250, 600];
    default:
      return [200, 500];
  }
}

function profileSellerCount(profile: string): [number, number] {
  switch (profile) {
    case "trap_saturation":
      return [80, 220];
    case "trap_ad_dependency":
      return [25, 60];
    case "trap_landed_cost":
      return [12, 28]; // healthy, not saturated — the trap here is economics, not competition
    case "solid_beginner":
      return [12, 30];
    case "underserved_niche":
      return [4, 12];
    case "trap_regulatory":
      return [10, 25];
    default:
      return [15, 40];
  }
}

function profileDominantBrandShare(profile: string, rand: () => number): number {
  switch (profile) {
    case "trap_saturation":
      return randFloat(rand, 0.4, 0.62);
    case "trap_ad_dependency":
      return randFloat(rand, 0.2, 0.35);
    case "underserved_niche":
      return randFloat(rand, 0.05, 0.16);
    default:
      return randFloat(rand, 0.15, 0.28);
  }
}

export class MockMarketplaceProvider implements MarketplaceProvider {
  async searchListings(query: string, market: "US"): Promise<ListingResult[]> {
    const candidate = getCandidateById(query);
    const profile = candidate?.mockProfile ?? "solid_beginner";
    const rand = seededRandom(`marketplace-listings-${query}-${market}`);
    const [minDemand, maxDemand] = profileDemandRange(profile);
    const [minSellers, maxSellers] = profileSellerCount(profile);
    const source = makeSource("marketplace", SOURCE_NAME);
    const count = 5;

    return Array.from({ length: count }).map((_, i) => {
      const monthlySales = randInt(rand, minDemand, maxDemand);
      const sellerCount = randInt(rand, minSellers, maxSellers);
      const dominantShare = profileDominantBrandShare(profile, rand);
      const price = candidate
        ? randFloat(rand, candidate.basePriceHint * 0.85, candidate.basePriceHint * 1.25)
        : randFloat(rand, 12, 40);

      return {
        ...makeEvidence({
          dataType: "demand",
          claim: `Estimated monthly unit sales for a comparable listing (#${i + 1}) of "${
            candidate?.name ?? query
          }" is ${monthlySales} units/month.`,
          value: monthlySales,
          unit: "units/month",
          source,
          confidence: 62,
          assumptions: [
            "Derived from a mock BSR-to-sales estimation model, not live sales data.",
          ],
        }),
        listingId: `mock-listing-${query}-${i}`,
        title: `${candidate?.name ?? query} — Comparable Listing ${i + 1}`,
        price,
        estimatedMonthlySales: monthlySales,
        rating: randFloat(rand, 3.7, 4.8, 1),
        reviewCount: randInt(rand, 40, 3200),
        sellerCount,
        dominantBrandShare: dominantShare,
      } satisfies ListingResult;
    });
  }

  async getListingReviews(listingId: string): Promise<ReviewResult[]> {
    const rand = seededRandom(`marketplace-reviews-${listingId}`);
    const source = makeSource("marketplace", SOURCE_NAME);
    const themes: ReviewResult["theme"][] = [
      "durability",
      "sizing",
      "packaging",
      "usability",
      "shipping_damage",
      "value_perception",
      "feature_request",
    ];
    const complaintSnippets: Record<ReviewResult["theme"], string[]> = {
      durability: [
        "broke after about three weeks of normal use",
        "the hinge/clasp cracked sooner than expected",
      ],
      sizing: ["runs smaller than the listing photos suggest", "doesn't fit the space I measured for"],
      packaging: ["arrived with the retail box crushed", "no protective insert, item shifted in transit"],
      usability: ["instructions were unclear on first setup", "harder to clean than expected"],
      shipping_damage: ["one corner was dented on arrival", "outer box was damaged but item was fine"],
      value_perception: ["fine but overpriced for what it is", "cheaper alternative works just as well"],
      feature_request: ["wish it came in a larger size", "would buy again if it had a carrying strap"],
      other: ["mixed experience overall"],
    };

    return Array.from({ length: 8 }).map((_, i) => {
      const theme = pick(rand, themes);
      const rating = randInt(rand, 1, 5);
      const text = pick(rand, complaintSnippets[theme]);
      return {
        ...makeEvidence({
          dataType: "review",
          claim: `A ${rating}-star review on a comparable listing mentions: "${text}."`,
          value: rating,
          source,
          confidence: 55,
        }),
        reviewId: `mock-review-${listingId}-${i}`,
        rating,
        text,
        theme,
      } satisfies ReviewResult;
    });
  }

  async estimateFees(listingPrice: number, category: string): Promise<FeeEstimate> {
    const rand = seededRandom(`marketplace-fees-${category}`);
    const source = makeSource("marketplace", SOURCE_NAME);
    const referralFeePercent = category.toLowerCase().includes("electronics")
      ? randFloat(rand, 7, 9)
      : randFloat(rand, 12, 15);
    // Fulfillment fee scales roughly with price tier (a proxy for size/weight tier), since a
    // flat fee applied uniformly to a $10 item and a $35 item was distorting margins.
    const fulfillmentFeeFlat =
      listingPrice < 15
        ? randFloat(rand, 2.6, 3.6)
        : listingPrice < 30
        ? randFloat(rand, 3.4, 4.6)
        : randFloat(rand, 4.8, 6.4);

    return {
      ...makeEvidence({
        dataType: "marketplace_fee",
        claim: `Estimated marketplace referral fee for the "${category}" category is ${referralFeePercent.toFixed(
          1
        )}%, plus a flat fulfillment fee of about $${fulfillmentFeeFlat.toFixed(2)} per unit.`,
        value: referralFeePercent,
        unit: "%",
        source,
        confidence: 70,
        assumptions: ["Based on typical 2025-2026 published category fee schedules, applied generically."],
      }),
      referralFeePercent,
      fulfillmentFeeFlat,
    };
  }

  async estimateAdCost(categoryOrCandidateId: string): Promise<AdCostEstimate> {
    // Callers pass the candidate id (mirroring searchListings) so the mock provider can
    // stay internally consistent with the candidate's designed profile. A live provider
    // would instead take a real category string.
    const candidate = getCandidateById(categoryOrCandidateId);
    const category = candidate?.category ?? categoryOrCandidateId;
    const profile = candidate?.mockProfile ?? "solid_beginner";
    const rand = seededRandom(`marketplace-ads-${categoryOrCandidateId}`);
    const source = makeSource("marketplace", SOURCE_NAME);

    let acosPercent: number;
    let dependencyLevel: AdCostEstimate["dependencyLevel"];
    if (profile === "trap_ad_dependency") {
      acosPercent = randFloat(rand, 30, 46);
      dependencyLevel = acosPercent > 40 ? "EXTREME" : "HIGH";
    } else if (profile === "trap_saturation") {
      acosPercent = randFloat(rand, 20, 30);
      dependencyLevel = "MEDIUM";
    } else {
      acosPercent = randFloat(rand, 6, 16);
      dependencyLevel = acosPercent > 12 ? "MEDIUM" : "LOW";
    }

    return {
      ...makeEvidence({
        dataType: "advertising_cost",
        claim: `Estimated advertising cost of sales (ACoS) for "${category}" is ${acosPercent.toFixed(
          1
        )}%, classified as ${dependencyLevel} paid-traffic dependency.`,
        value: acosPercent,
        unit: "%",
        source,
        confidence: 48,
        assumptions: ["Category-level ACoS estimate, not specific to this exact product."],
      }),
      estimatedCpc: randFloat(rand, 0.6, 2.4),
      estimatedAcosPercent: acosPercent,
      dependencyLevel,
    };
  }
}
