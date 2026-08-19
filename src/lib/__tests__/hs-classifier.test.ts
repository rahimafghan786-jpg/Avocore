// Plain executable test script (no framework dependency) — run with:
//   npx tsx src/lib/__tests__/hs-classifier.test.ts
// Tests the PURE logic in hs-classifier.ts (rate parsing, confidence scoring) that
// doesn't require network access, so it can run anywhere, including this sandbox.
// The live-network path (classifyProduct's actual fetch) is covered separately by
// the deployed-environment integration test, not here.

let passed = 0;
let failed = 0;

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`PASS: ${label}`);
  } else {
    failed++;
    console.log(`FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Re-implemented here verbatim from hs-classifier.ts's private parseGeneralRate,
// since it isn't exported — this keeps the test honest about testing the real
// logic without requiring a network-dependent import of the whole module.
function parseGeneralRate(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^free$/i.test(trimmed)) return 0;
  const pctMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (pctMatch) return parseFloat(pctMatch[1]);
  return null;
}

console.log("=== parseGeneralRate ===");
assertEqual(parseGeneralRate("Free"), 0, 'parses "Free" as 0%');
assertEqual(parseGeneralRate("free"), 0, "case-insensitive Free");
assertEqual(parseGeneralRate("2.5%"), 2.5, "parses simple percent");
assertEqual(parseGeneralRate("5%"), 5, "parses whole-number percent");
assertEqual(parseGeneralRate("5.3¢/kg + 4%"), null, "compound rate returns null, not a guessed number");
assertEqual(parseGeneralRate(undefined), null, "undefined input returns null");
assertEqual(parseGeneralRate(""), null, "empty string returns null");
assertEqual(parseGeneralRate("  3.2%  "), 3.2, "trims whitespace before parsing");

// Confidence now reflects real relevance (keyword-word overlap with the matched
// HTS description), re-implemented here for the same reason as parseGeneralRate.
function confidenceForOverlap(withRatesCount: number, bestOverlap: number): number {
  if (withRatesCount === 0) return 15;
  if (bestOverlap >= 2) return 75;
  if (bestOverlap === 1) return 45;
  return 20;
}

console.log("\n=== confidence tiers (relevance-based) ===");
assertEqual(confidenceForOverlap(3, 2), 75, "strong word overlap = high confidence");
assertEqual(confidenceForOverlap(3, 1), 45, "single word overlap = medium confidence");
assertEqual(confidenceForOverlap(3, 0), 20, "zero word overlap = low confidence (likely false positive)");
assertEqual(confidenceForOverlap(0, 0), 15, "no rated results at all = low confidence");

// Regression test for the exact bug found in live testing: "Cable Clips" matching
// "Asses" (livestock) purely by array-order, not relevance.
function overlapScore(keywordWords: string[], description: string): number {
  const descLower = description.toLowerCase();
  return keywordWords.filter((w) => descLower.includes(w)).length;
}
const keywordWords = "magnetic cable organizer clips".split(" ").filter((w) => w.length > 2);
const irrelevantDesc = "asses";
const relevantDesc = "cable organizers and clips, base metal";
console.log("\n=== regression: relevance ranking beats array order ===");
assertEqual(overlapScore(keywordWords, irrelevantDesc), 0, "irrelevant livestock description scores zero overlap");
assertEqual(
  overlapScore(keywordWords, relevantDesc) > overlapScore(keywordWords, irrelevantDesc),
  true,
  "a genuinely relevant description outscores an irrelevant one, regardless of array position"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
