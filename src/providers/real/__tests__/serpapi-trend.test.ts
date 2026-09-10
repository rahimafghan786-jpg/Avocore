// Run with: npx tsx src/providers/real/__tests__/serpapi-trend.test.ts
import type { TrendProvider, TrendResult } from "../../../domain/provider";
import { SerpApiTrendProvider, classifyTrend } from "../serpapi-trend.provider";

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

// Fallback wrapper copy (mirrors registry.ts's TrendProviderWithFallback) so this test
// doesn't need to import the whole registry module just to exercise the fallback path.
class FakeMockTrendProvider implements TrendProvider {
  async getTrend(term: string): Promise<TrendResult> {
    return {
      id: "mock-1",
      dataType: "trend",
      classification: "MOCK",
      claim: `Mock trend for ${term}`,
      source: { id: "m", name: "Mock", providerKey: "trend" },
      collectedAt: new Date().toISOString(),
      confidence: 50,
      term,
      trendType: "established",
    };
  }
}

class TrendProviderWithFallback implements TrendProvider {
  constructor(private real: TrendProvider, private mock: TrendProvider) {}
  async getTrend(term: string, market: "US") {
    try {
      return await this.real.getTrend(term, market);
    } catch (err) {
      console.error("(expected in test) Real TrendProvider failed, falling back:", (err as Error).message);
      const fallback = await this.mock.getTrend(term, market);
      return { ...fallback, claim: `[REAL DATA UNAVAILABLE — USING MOCK DATA] ${fallback.claim}` };
    }
  }
}

async function main() {
  console.log("=== SerpApi trend fallback ===");
  delete process.env.SERPAPI_KEY;

  const wrapper = new TrendProviderWithFallback(new SerpApiTrendProvider(), new FakeMockTrendProvider());
  const result = await wrapper.getTrend("widget", "US");

  check(result.classification === "MOCK", "falls back to mock when SERPAPI_KEY isn't configured");
  check(
    result.claim.startsWith("[REAL DATA UNAVAILABLE — USING MOCK DATA]"),
    "fallback result is visibly marked"
  );

  console.log("\n=== Real provider throws (not silent) when unconfigured ===");
  let threwAsExpected = false;
  try {
    await new SerpApiTrendProvider().getTrend("widget");
  } catch {
    threwAsExpected = true;
  }
  check(threwAsExpected, "real SerpApi provider throws rather than silently returning fake data");

  console.log("\n=== classifyTrend rules ===");
  check(classifyTrend([1, 2]) === "noise", "too few data points classifies as noise");
  check(
    classifyTrend([10, 10, 11, 9, 10, 10, 9, 11, 5, 100]) === "viral_spike",
    "a huge final spike above 3x the mean classifies as viral_spike"
  );
  check(
    classifyTrend([50, 48, 52, 49, 51, 10, 8, 9, 7, 8]) === "declining",
    "sharp drop in recent values vs. early values classifies as declining"
  );
  check(
    classifyTrend([5, 6, 7, 8, 20, 22, 25, 28, 30, 32]) === "emerging",
    "sustained rise from early to recent values classifies as emerging"
  );
  check(
    classifyTrend([10, 60, 15, 55, 12, 58, 14, 52, 11, 56]) === "seasonal",
    "high variance with no net directional trend classifies as seasonal"
  );
  check(
    classifyTrend([40, 42, 41, 43, 40, 42, 41, 40, 43, 41]) === "established",
    "steady, low-variance values classify as established"
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
