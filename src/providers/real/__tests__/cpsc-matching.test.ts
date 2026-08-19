// Run with: npx tsx src/providers/real/__tests__/cpsc-matching.test.ts
// Tests the pure buildAssessment decision function with injected fixtures — no
// network call, runs anywhere. Covers all 7 scenarios required for Phase 2A Fix 2.

import { buildAssessment, CpscRecallRow } from "../cpsc.provider";

let passed = 0;
let failed = 0;
function check(condition: boolean, label: string) {
  if (condition) { passed++; console.log(`PASS: ${label}`); }
  else { failed++; console.log(`FAIL: ${label}`); }
}

function row(overrides: Partial<CpscRecallRow>): CpscRecallRow {
  return { RecallID: 1, RecallNumber: "R-1", Title: "", Description: "", Products: [], Hazards: [], ...overrides };
}

// --- 1. Exact product match ---
console.log("=== 1. Exact product match ===");
{
  const result = buildAssessment({
    category: "Pet Electronics",
    specificQuery: "Pet Nail Grinder",
    productRows: [row({ Title: "LED Rechargeable Pet Nail Grinder Recalled Due to Fire Hazard" })],
    categoryRows: [],
  });
  check(result.matchType === "STRONG_PRODUCT_MATCH", "exact product name in title yields STRONG_PRODUCT_MATCH");
  check(result.requiresStopAndVerify === true, "strong match forces STOP AND VERIFY");
  check(result.classification === "VERIFIED", "strong match is classified VERIFIED, not just OBSERVED");
}

// --- 2. Brand/model match ---
console.log("\n=== 2. Brand/model match ===");
{
  const result = buildAssessment({
    category: "Pet Electronics",
    specificQuery: "Acme Pet Nail Grinder Model X200",
    productRows: [row({ Title: "Acme Pet Nail Grinder Model X200 Recalled" })],
    categoryRows: [],
  });
  check(result.matchType === "STRONG_PRODUCT_MATCH", "brand+model overlap yields STRONG_PRODUCT_MATCH");
}

// --- 3. Product-type match (related but not the same product) ---
console.log("\n=== 3. Product-type match ===");
{
  const result = buildAssessment({
    category: "Pet Electronics",
    specificQuery: "Pet Nail Grinder",
    productRows: [row({ Title: "Pet Grooming Clippers Recalled Due to Blade Hazard" })], // shares "pet" only
    categoryRows: [],
  });
  check(result.matchType === "PRODUCT_TYPE_MATCH", "partial word overlap yields PRODUCT_TYPE_MATCH, not STRONG");
  check(result.classification === "OBSERVED", "product-type match is OBSERVED, not VERIFIED");
}

// --- 4. Category-only match ---
console.log("\n=== 4. Category-only match ===");
{
  const result = buildAssessment({
    category: "Outdoor",
    specificQuery: "Insulated Cooler Backpack",
    productRows: [], // product query returned nothing
    categoryRows: [row({ Title: "Ceiling Fans Recalled Due to Impact Hazard" })],
  });
  check(result.matchType === "CATEGORY_MATCH", "product query empty, category query nonempty yields CATEGORY_MATCH");
  check(
    !result.claim.match(/this product (has|was) (been )?recalled/i),
    "category match never claims the specific product was recalled"
  );
  check(result.claim.includes("NOT a claim"), "category match explicitly disclaims specific-product certainty");
}

// --- 5. Irrelevant recall (the exact bug found and fixed) ---
console.log("\n=== 5. Irrelevant recall (zero-overlap regression) ===");
{
  const result = buildAssessment({
    category: "Home Office",
    specificQuery: "Magnetic Cable Clips",
    productRows: [row({ Title: "Asses", Description: "Live donkey import classification" })], // zero real overlap
    categoryRows: [row({ Title: "Desk Lamp Recalled Due to Shock Hazard" })],
  });
  check(
    result.matchType === "CATEGORY_MATCH",
    "zero-overlap product row falls through to category-level result, not misreported as PRODUCT_TYPE_MATCH"
  );
}

// --- 6. Empty result at both levels ---
console.log("\n=== 6. Empty result ===");
{
  const result = buildAssessment({
    category: "Home Organization",
    specificQuery: "Bamboo Drawer Trays",
    productRows: [],
    categoryRows: [],
  });
  check(result.matchType === "NO_RELEVANT_MATCH", "both queries empty yields NO_RELEVANT_MATCH");
  check(/does not mean.*is safe/i.test(result.claim), "empty result explicitly disclaims that no-match means safe (a negation, not a bare claim)");
  check(result.requiresStopAndVerify === false, "empty result doesn't force STOP AND VERIFY");
}

// --- 7. Ambiguous result (borderline score, multiple rows of mixed relevance) ---
console.log("\n=== 7. Ambiguous result ===");
{
  const result = buildAssessment({
    category: "Kitchen",
    specificQuery: "Silicone Travel Cutting Board",
    productRows: [
      row({ Title: "Plastic Cutting Board Recalled" }), // shares "cutting" + "board" = 2 words
      row({ Title: "Silicone Baking Mat Recalled" }), // shares "silicone" = 1 word
    ],
    categoryRows: [],
  });
  // "Silicone Travel Cutting Board" -> words: silicone, travel, cutting, board (4 words, threshold = ceil(4*0.6)=3)
  // Best row scores 2 ("cutting","board") - below threshold of 3, so PRODUCT_TYPE not STRONG.
  check(result.matchType === "PRODUCT_TYPE_MATCH", "borderline multi-row overlap correctly lands as PRODUCT_TYPE_MATCH, not STRONG");
  check(result.matchReason!.includes("2 of 4"), "matchReason reports the actual overlap count transparently");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
