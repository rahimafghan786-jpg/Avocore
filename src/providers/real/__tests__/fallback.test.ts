// Run with: npx tsx src/providers/real/__tests__/fallback.test.ts
import type { RegulatoryProvider, RegulatoryAssessment } from "../../../domain/provider";

let passed = 0;
let failed = 0;
function check(condition: boolean, label: string) {
  if (condition) { passed++; console.log(`PASS: ${label}`); }
  else { failed++; console.log(`FAIL: ${label}`); }
}

class FailingRegulatoryProvider implements RegulatoryProvider {
  async assessCategory(): Promise<RegulatoryAssessment> {
    throw new Error("simulated network failure");
  }
}
class FakeMockRegulatoryProvider implements RegulatoryProvider {
  async assessCategory(category: string): Promise<RegulatoryAssessment> {
    return {
      id: "mock",
      dataType: "regulatory",
      classification: "MOCK",
      claim: `Mock assessment for ${category}`,
      source: { id: "m", name: "Mock", providerKey: "regulatory" },
      collectedAt: new Date().toISOString(),
      confidence: 50,
      category,
      riskScore: 10,
      requiredAgencies: [],
      requiresStopAndVerify: false,
    };
  }
}
class RegulatoryProviderWithFallback implements RegulatoryProvider {
  constructor(private real: RegulatoryProvider, private mock: RegulatoryProvider) {}
  async assessCategory(category: string, productName?: string) {
    try {
      return await this.real.assessCategory(category, productName);
    } catch {
      const fallback = await this.mock.assessCategory(category, productName);
      return { ...fallback, claim: `[REAL DATA UNAVAILABLE — USING MOCK DATA] ${fallback.claim}` };
    }
  }
}

async function run() {
  const wrapped = new RegulatoryProviderWithFallback(new FailingRegulatoryProvider(), new FakeMockRegulatoryProvider());
  const result = await wrapped.assessCategory("test category", "Test Product");
  console.log("=== Fallback wrapper ===");
  check(result.claim.startsWith("[REAL DATA UNAVAILABLE"), "fallback result's claim is visibly marked");
  check(result.classification === "MOCK", "fallback result is honestly classified MOCK");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
run();
