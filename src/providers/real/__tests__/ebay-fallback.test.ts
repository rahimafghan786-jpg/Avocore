// Run with: npx tsx src/providers/real/__tests__/ebay-fallback.test.ts
import type { MarketplaceProvider, ListingResult } from "../../../domain/provider";
import { MarketplaceProviderWithEbayFallback, EbayListingSearchProvider } from "../ebay-marketplace.provider";

let passed = 0;
let failed = 0;
function check(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`PASS: ${label}`);
  } else {
    failed++;
    console.log(`FAIL: ${label}`);
  }
}

class FakeMockMarketplaceProvider implements MarketplaceProvider {
  async searchListings(query: string): Promise<ListingResult[]> {
    return [
      {
        id: "mock-1",
        dataType: "demand",
        classification: "MOCK",
        claim: `Mock demand result for ${query}`,
        source: { id: "m", name: "Mock", providerKey: "marketplace" },
        collectedAt: new Date().toISOString(),
        confidence: 50,
        listingId: "mock-listing-1",
        title: "Mock listing",
        price: 19.99,
        estimatedMonthlySales: 300,
      },
    ];
  }
  async getListingReviews() {
    return [];
  }
  async estimateFees() {
    return {
      id: "m2",
      dataType: "marketplace_fee" as const,
      classification: "MOCK" as const,
      claim: "mock fee",
      source: { id: "m", name: "Mock", providerKey: "marketplace" },
      collectedAt: new Date().toISOString(),
      confidence: 50,
      referralFeePercent: 15,
      fulfillmentFeeFlat: 5,
    };
  }
  async estimateAdCost() {
    return {
      id: "m3",
      dataType: "advertising_cost" as const,
      classification: "MOCK" as const,
      claim: "mock ad cost",
      source: { id: "m", name: "Mock", providerKey: "marketplace" },
      collectedAt: new Date().toISOString(),
      confidence: 50,
      estimatedCpc: 1,
      estimatedAcosPercent: 20,
      dependencyLevel: "MEDIUM" as const,
    };
  }
}

async function main() {
  console.log("=== eBay marketplace fallback ===");

  // 1. Without EBAY_APP_ID/EBAY_CERT_ID set, the real provider must throw, and the
  // composite wrapper must fall back to mock with the visible marker prefix.
  delete process.env.EBAY_APP_ID;
  delete process.env.EBAY_CERT_ID;

  const wrapper = new MarketplaceProviderWithEbayFallback(
    new EbayListingSearchProvider(),
    new FakeMockMarketplaceProvider()
  );
  const results = await wrapper.searchListings("test product", "US");

  check(results.length === 1, "fallback returns the mock result when eBay isn't configured");
  check(
    results[0].claim.startsWith("[REAL DATA UNAVAILABLE — USING MOCK DATA]"),
    "fallback result's claim is visibly marked"
  );
  check(results[0].classification === "MOCK", "fallback result is honestly classified MOCK");

  // 2. estimatedMonthlySales must never be silently invented by the real provider path —
  // the mock fallback path is allowed to have it (that's the mock's own number), but a
  // *real* eBay result must never carry a fabricated sales figure.
  const realProviderOnly = new EbayListingSearchProvider();
  let threwAsExpected = false;
  try {
    await realProviderOnly.searchListings("test product");
  } catch {
    threwAsExpected = true;
  }
  check(threwAsExpected, "real eBay provider throws (not silently returns fake data) when unconfigured");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
