import { MarketplaceProvider, ListingResult } from "@/domain/provider";

// Combines results from however many real marketplace sources are configured (eBay, Amazon,
// and any future addition) into one array, rather than treating "which marketplace" as a
// single provider swap. This matches how Moh actually sells — across multiple marketplaces
// simultaneously — rather than Avocore only ever knowing about one at a time.
//
// Behavior:
// - Each configured real source is attempted in parallel.
// - A source that isn't configured (missing credentials) or that fails is logged and simply
//   contributes nothing — it does NOT poison the other sources' results.
// - If at least one real source returned results, those are returned as-is (real data,
//   never blended with unlabeled mock).
// - If every configured source failed or none are configured, falls back to the mock
//   provider with the same visible "[REAL DATA UNAVAILABLE — USING MOCK DATA]" marker used
//   elsewhere, so the UI is never silently wrong about what it's showing.
export interface NamedMarketplaceSearchSource {
  name: string;
  isConfigured: () => boolean;
  searchListings: (query: string) => Promise<ListingResult[]>;
}

export class CompositeMarketplaceProvider implements MarketplaceProvider {
  constructor(
    private realSources: NamedMarketplaceSearchSource[],
    private mock: MarketplaceProvider
  ) {}

  async searchListings(query: string, market: "US"): Promise<ListingResult[]> {
    const configuredSources = this.realSources.filter((s) => s.isConfigured());

    if (configuredSources.length === 0) {
      const fallback = await this.mock.searchListings(query, market);
      return fallback.map((l) => ({
        ...l,
        claim: `[REAL DATA UNAVAILABLE — USING MOCK DATA] ${l.claim}`,
      }));
    }

    const attempts = await Promise.allSettled(
      configuredSources.map((s) => s.searchListings(query))
    );

    const combined: ListingResult[] = [];
    let anySucceeded = false;
    attempts.forEach((result, i) => {
      if (result.status === "fulfilled") {
        anySucceeded = true;
        combined.push(...result.value);
      } else {
        console.error(
          `Real MarketplaceProvider (${configuredSources[i].name}) failed, falling back to mock for this source:`,
          result.reason
        );
      }
    });

    if (!anySucceeded) {
      const fallback = await this.mock.searchListings(query, market);
      return fallback.map((l) => ({
        ...l,
        claim: `[REAL DATA UNAVAILABLE — USING MOCK DATA] ${l.claim}`,
      }));
    }

    return combined;
  }

  getListingReviews: MarketplaceProvider["getListingReviews"] = (listingId) =>
    this.mock.getListingReviews(listingId);

  estimateFees: MarketplaceProvider["estimateFees"] = (listingPrice, category) =>
    this.mock.estimateFees(listingPrice, category);

  estimateAdCost: MarketplaceProvider["estimateAdCost"] = (category) =>
    this.mock.estimateAdCost(category);
}
