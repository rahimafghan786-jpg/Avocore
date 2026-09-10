// Run with: npx tsx src/agents/__tests__/census-trade-wiring.test.ts
import { toHs6, recentPublishedMonth, runFinancialAgent } from "../financial-agent";
import type { ProviderRegistry } from "../../domain/provider";
import type { AgentInput } from "../../domain/agent";
import type { CandidateProduct, ResearchRequest } from "../../domain/opportunity";

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

console.log("=== HS6 normalization ===");
check(toHs6("9403.90.4010") === "940390", "strips dots and takes first 6 digits");
check(toHs6("940390") === "940390", "already-bare 6-digit code passes through");
check(toHs6("94") === null, "too-short code returns null rather than a partial guess");
check(toHs6("UNKNOWN") === null, "non-numeric code returns null, not a garbage string");

console.log("\n=== Recent published month ===");
const month = recentPublishedMonth();
check(/^\d{4}-\d{2}$/.test(month), "returns YYYY-MM format");
const [y, m] = month.split("-").map(Number);
const now = new Date();
const expected = new Date(now.getFullYear(), now.getMonth() - 3, 1);
check(y === expected.getFullYear() && m === expected.getMonth() + 1, "is exactly 3 months before now (publication lag buffer)");

console.log("\n=== FinancialAgent doesn't require CENSUS_API_KEY to run ===");
delete process.env.CENSUS_API_KEY;

const mockProviders = {
  supplier: { findSuppliers: async () => [] },
  marketplace: {
    searchListings: async () => [],
    getListingReviews: async () => [],
    estimateFees: async () => ({
      id: "f",
      dataType: "marketplace_fee" as const,
      classification: "MOCK" as const,
      claim: "fee",
      source: { id: "s", name: "s", providerKey: "marketplace" },
      collectedAt: new Date().toISOString(),
      confidence: 50,
      referralFeePercent: 15,
      fulfillmentFeeFlat: 5,
    }),
    estimateAdCost: async () => ({
      id: "a",
      dataType: "advertising_cost" as const,
      classification: "MOCK" as const,
      claim: "ad",
      source: { id: "s", name: "s", providerKey: "marketplace" },
      collectedAt: new Date().toISOString(),
      confidence: 50,
      estimatedCpc: 1,
      estimatedAcosPercent: 20,
      dependencyLevel: "MEDIUM" as const,
    }),
  },
  shipping: {
    estimateFreight: async () => ({
      id: "sh",
      dataType: "shipping" as const,
      classification: "MOCK" as const,
      claim: "ship",
      source: { id: "s", name: "s", providerKey: "shipping" },
      collectedAt: new Date().toISOString(),
      confidence: 50,
      costPerUnit: 2,
      transitDays: 20,
    }),
  },
  tariff: {
    lookupDuty: async () => ({
      id: "t",
      dataType: "tariff" as const,
      classification: "OBSERVED" as const,
      claim: "tariff",
      source: { id: "s", name: "s", providerKey: "tariff" },
      collectedAt: new Date().toISOString(),
      confidence: 70,
      htsCodeGuess: "9403.90.4010",
      dutyRatePercent: 5,
      requiresBrokerConfirmation: true,
    }),
  },
} as unknown as ProviderRegistry;

const candidate: CandidateProduct = {
  id: "cand-test",
  name: "Test Product",
  category: "Kitchen",
  problemSolved: "test",
  targetCustomer: "test",
  supplierCountryHint: "China",
  basePriceHint: 20,
  unitWeightKgHint: 0.3,
  mockProfile: "solid_beginner",
};
const request: ResearchRequest = {
  capital: 2000,
  market: "US",
  experienceLevel: "beginner",
  riskTolerance: "moderate",
  requestedCount: 5,
  rawMessage: "test",
};
const input: AgentInput = { candidate, request };

async function main() {
  const result = await runFinancialAgent(mockProviders, input);
  check(result.agent === "FinancialAgent", "agent runs successfully without CENSUS_API_KEY set");
  check(
    result.evidence.every((e) => e.dataType !== "tariff" || e.source.providerKey !== "trade"),
    "no census trade evidence is added when CENSUS_API_KEY is unset (supplementary, not required)"
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
