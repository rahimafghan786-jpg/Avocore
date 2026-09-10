// Run with: npx tsx src/providers/real/__tests__/composite-marketplace.test.ts
import type { MarketplaceProvider, ListingResult } from "../../../domain/provider";
import { CompositeMarketplaceProvider, NamedMarketplaceSearchSource } from "../composite-marketplace.provider";

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

function makeListing(sourceName: string, id: string): ListingResult {
  return {
    id,
    dataType: "demand",
    classification: "OBSERVED",
    claim: `Real listing from ${sourceName}`,
    source: { id: `src-${sourceName}`, name: sourceName, providerKey: "marketplace" },
    collectedAt: new Date().toISOString(),
    confidence: 75,
    listingId: id,
    title: `Item from ${sourceName}`,
    price: 19.99,
  };
}

class FakeMock implements MarketplaceProvider {
  async searchListings(query: string): Promise<ListingResult[]> {
    return [
      {
        id: "mock-1",
        dataType: "demand",
        classification: "MOCK",
        claim: `Mock result for ${query}`,
        source: { id: "m", name: "Mock", providerKey: "marketplace" },
        collectedAt: new Date().toISOString(),
        confidence: 50,
        listingId: "mock-1",
        title: "Mock item",
        price: 9.99,
      },
    ];
  }
  async getListingReviews() {
    return [];
  }
  async estimateFees() {
    return {
      id: "f",
      dataType: "marketplace_fee" as const,
      classification: "MOCK" as const,
      claim: "mock",
      source: { id: "m", name: "Mock", providerKey: "marketplace" },
      collectedAt: new Date().toISOString(),
      confidence: 50,
      referralFeePercent: 15,
      fulfillmentFeeFlat: 5,
    };
  }
  async estimateAdCost() {
    return {
      id: "a",
      dataType: "advertising_cost" as const,
      classification: "MOCK" as const,
      claim: "mock",
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
  console.log("=== Composite marketplace provider ===");

  // 1. No sources configured at all -> full mock fallback, visibly labeled.
  const noneConfigured: NamedMarketplaceSearchSource[] = [
    { name: "eBay", isConfigured: () => false, searchListings: async () => [] },
    { name: "Amazon", isConfigured: () => false, searchListings: async () => [] },
  ];
  const p1 = new CompositeMarketplaceProvider(noneConfigured, new FakeMock());
  const r1 = await p1.searchListings("widget", "US");
  check(r1.length === 1 && r1[0].classification === "MOCK", "falls back to mock when nothing is configured");
  check(
    r1[0].claim.startsWith("[REAL DATA UNAVAILABLE — USING MOCK DATA]"),
    "mock fallback is visibly labeled"
  );

  // 2. Both sources configured and both succeed -> combined real results, no mock mixed in.
  const bothSucceed: NamedMarketplaceSearchSource[] = [
    { name: "eBay", isConfigured: () => true, searchListings: async () => [makeListing("eBay", "e1")] },
    { name: "Amazon", isConfigured: () => true, searchListings: async () => [makeListing("Amazon", "a1")] },
  ];
  const p2 = new CompositeMarketplaceProvider(bothSucceed, new FakeMock());
  const r2 = await p2.searchListings("widget", "US");
  check(r2.length === 2, "combines results from multiple configured real sources");
  check(
    r2.every((l) => l.classification === "OBSERVED"),
    "combined results stay real (OBSERVED), no mock blended in"
  );

  // 3. One source configured and fails, the other configured and succeeds -> only the
  // successful one's results are used, the failure doesn't poison the whole response.
  const oneFails: NamedMarketplaceSearchSource[] = [
    {
      name: "eBay",
      isConfigured: () => true,
      searchListings: async () => {
        throw new Error("simulated eBay outage");
      },
    },
    { name: "Amazon", isConfigured: () => true, searchListings: async () => [makeListing("Amazon", "a2")] },
  ];
  const p3 = new CompositeMarketplaceProvider(oneFails, new FakeMock());
  const r3 = await p3.searchListings("widget", "US");
  check(r3.length === 1 && r3[0].source.name === "Amazon", "one source failing doesn't block the other's real results");

  // 4. All configured sources fail -> full mock fallback, not an empty array.
  const allFail: NamedMarketplaceSearchSource[] = [
    {
      name: "eBay",
      isConfigured: () => true,
      searchListings: async () => {
        throw new Error("simulated eBay outage");
      },
    },
    {
      name: "Amazon",
      isConfigured: () => true,
      searchListings: async () => {
        throw new Error("simulated Amazon outage");
      },
    },
  ];
  const p4 = new CompositeMarketplaceProvider(allFail, new FakeMock());
  const r4 = await p4.searchListings("widget", "US");
  check(r4.length === 1 && r4[0].classification === "MOCK", "falls back to mock when every configured source fails");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
