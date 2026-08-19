import { RegulatoryProvider, RegulatoryAssessment } from "@/domain/provider";
import { randomUUID } from "crypto";

export const CPSC_SOURCE = {
  id: "src-cpsc-recalls",
  name: "U.S. CPSC Recalls Database (official, saferproducts.gov)",
  url: "https://www.saferproducts.gov/",
  providerKey: "regulatory",
};

export interface CpscRecallRow {
  RecallID?: number;
  RecallNumber?: string;
  RecallDate?: string;
  Description?: string;
  Title?: string;
  URL?: string;
  Products?: Array<{ Name?: string }>;
  Hazards?: Array<{ Name?: string }>;
}

export function cleanKeyword(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(set of \d+|pack of \d+|\d+-pack)\b/gi, "")
    .trim();
}

export function wordsOf(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
}

// Scores how specifically a recall row's own text (title/description/product names)
// matches the queried product name — this is what separates "the exact product was
// recalled" from "something vaguely related showed up in a broad search."
export function specificityScore(row: CpscRecallRow, productWords: string[]): number {
  const rowText = [
    row.Title ?? "",
    row.Description ?? "",
    ...(row.Products ?? []).map((p) => p.Name ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return productWords.filter((w) => rowText.includes(w)).length;
}

// Pure decision function — takes already-fetched rows, returns the assessment.
// Exported specifically so tests can exercise the 4-tier matching logic with
// injected fixtures, with zero network dependency.
//
// Real bug found and fixed here while writing tests: a product-name query that
// returns rows with ZERO actual word overlap (CPSC's search can return loosely
// related results) was previously being classified as PRODUCT_TYPE_MATCH just
// because *some* rows came back — that's wrong; zero overlap means the rows aren't
// meaningfully related and this must fall through to the category-level check
// instead, exactly like an empty product-query result would.
export function buildAssessment(params: {
  category: string;
  specificQuery: string | null;
  productRows: CpscRecallRow[];
  categoryRows: CpscRecallRow[];
}): RegulatoryAssessment {
  const { category, specificQuery, productRows, categoryRows } = params;

  if (specificQuery && productRows.length > 0) {
    const productWords = wordsOf(specificQuery);
    const scored = productRows.map((r) => ({ row: r, score: specificityScore(r, productWords) }));
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    // Zero-overlap guard (the fixed bug): no product-relevant word appears in the
    // matched row at all — treat this exactly as if the product query had returned
    // nothing, and fall through to the category-level result below.
    if (best.score > 0) {
      const strongMatch = best.score >= Math.max(2, Math.ceil(productWords.length * 0.6));
      const matchedIds = productRows.map((r) => r.RecallNumber ?? String(r.RecallID ?? "")).filter(Boolean);
      const hazardNames = [
        ...new Set(productRows.flatMap((r) => (r.Hazards ?? []).map((h) => h.Name).filter(Boolean))),
      ] as string[];

      if (strongMatch) {
        return {
          id: randomUUID(),
          dataType: "regulatory",
          classification: "VERIFIED",
          claim: `STRONG PRODUCT MATCH: a CPSC recall record specifically matches "${specificQuery}" (title: "${best.row.Title}"). STOP AND VERIFY before sourcing or listing this exact product.`,
          source: CPSC_SOURCE,
          collectedAt: new Date().toISOString(),
          freshnessNote: "Live query against the official CPSC recalls database, queried by specific product name.",
          confidence: 90,
          query: specificQuery,
          rawReference: best.row.URL,
          category,
          riskScore: 90,
          requiredAgencies: ["CPSC"],
          requiresStopAndVerify: true,
          matchType: "STRONG_PRODUCT_MATCH",
          matchReason: `${best.score} of ${productWords.length} product-name words matched the recall's own title/description/product listing.`,
          matchedRecallIds: matchedIds.slice(0, 10),
          assumptions: hazardNames.length > 0 ? [`Documented hazards: ${hazardNames.slice(0, 5).join(", ")}`] : undefined,
        };
      }

      return {
        id: randomUUID(),
        dataType: "regulatory",
        classification: "OBSERVED",
        claim: `PRODUCT-TYPE MATCH: CPSC has recall record(s) for products of the same general type as "${specificQuery}" (example: "${best.row.Title}"), but not confirmed as this exact product. Investigate further before sourcing.`,
        source: CPSC_SOURCE,
        collectedAt: new Date().toISOString(),
        freshnessNote: "Live query against the official CPSC recalls database, queried by specific product name.",
        confidence: 65,
        query: specificQuery,
        rawReference: best.row.URL,
        category,
        riskScore: 60,
        requiredAgencies: ["CPSC"],
        requiresStopAndVerify: true,
        matchType: "PRODUCT_TYPE_MATCH",
        matchReason: `${best.score} of ${productWords.length} product-name words matched — related product type, not confirmed as the exact product.`,
        matchedRecallIds: matchedIds.slice(0, 10),
      };
    }
  }

  if (categoryRows.length > 0) {
    const matchedIds = categoryRows.map((r) => r.RecallNumber ?? String(r.RecallID ?? "")).filter(Boolean);
    const sampleTitle = categoryRows[0]?.Title ?? categoryRows[0]?.Description ?? "a recalled product in this category";
    return {
      id: randomUUID(),
      dataType: "regulatory",
      classification: "OBSERVED",
      claim: `CATEGORY MATCH ONLY: ${categoryRows.length} recall record(s) exist for the broad category "${category}" (example: "${sampleTitle}"), but no evidence was found tying a recall to this specific product. This is NOT a claim that this specific product has been recalled — it means the category has recall history in general. STOP AND VERIFY before sourcing.`,
      source: CPSC_SOURCE,
      collectedAt: new Date().toISOString(),
      freshnessNote: "Live query against the official CPSC recalls database, queried by broad category (no product-specific match found).",
      confidence: 40,
      query: category,
      rawReference: categoryRows[0]?.URL,
      category,
      riskScore: Math.min(70, 40 + categoryRows.length),
      requiredAgencies: ["CPSC"],
      requiresStopAndVerify: true,
      matchType: "CATEGORY_MATCH",
      matchReason: `No product-name-specific recall found; ${categoryRows.length} recalls exist for the broader "${category}" category.`,
      matchedRecallIds: matchedIds.slice(0, 10),
    };
  }

  return {
    id: randomUUID(),
    dataType: "regulatory",
    classification: "OBSERVED",
    claim: `No matching recall evidence was found in the CPSC recalls database for "${specificQuery ?? category}". This does not mean the product is safe — it means this specific query returned no matches. Regulatory risk should still be evaluated independently.`,
    source: CPSC_SOURCE,
    collectedAt: new Date().toISOString(),
    freshnessNote: "Live query against the official CPSC recalls database.",
    confidence: 45,
    query: specificQuery ?? category,
    category,
    riskScore: 20,
    requiredAgencies: [],
    requiresStopAndVerify: false,
    matchType: "NO_RELEVANT_MATCH",
    matchReason: "No rows returned from either a product-specific or category-level CPSC query.",
    matchedRecallIds: [],
    assumptions: ["A NO_RELEVANT_MATCH result reflects zero rows returned, not a confirmed absence of regulatory risk."],
  };
}

async function queryCpsc(productNameParam: string): Promise<CpscRecallRow[]> {
  const url = `https://www.saferproducts.gov/RestWebServices/Recall?ProductName=${encodeURIComponent(
    productNameParam
  )}&format=json`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CPSC API returned HTTP ${res.status}`);
  const rows = (await res.json()) as CpscRecallRow[];
  return Array.isArray(rows) ? rows : [];
}

// Real provider: queries the official CPSC Recalls REST API. No API key required.
// See docs/PROVIDERS.md for the exact endpoint and the 4-tier match model.
export class CpscRegulatoryProvider implements RegulatoryProvider {
  async assessCategory(category: string, productName?: string): Promise<RegulatoryAssessment> {
    const specificQuery = productName ? cleanKeyword(productName) : null;
    let productRows: CpscRecallRow[] = [];
    let categoryRows: CpscRecallRow[] = [];

    try {
      if (specificQuery) {
        productRows = await queryCpsc(specificQuery);
      }
      // Always also fetch category rows as a fallback data source — buildAssessment
      // decides which to actually use (product rows win only if truly relevant,
      // i.e. nonzero word overlap with the best match). Fetching both up front is
      // simpler and avoids having to pre-guess relevance before scoring runs.
      categoryRows = await queryCpsc(category);
    } catch (err) {
      throw new Error(`CPSC Recalls API request failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return buildAssessment({ category, specificQuery, productRows, categoryRows });
  }
}
