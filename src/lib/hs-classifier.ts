// HS/HTS classification. Deliberately does NOT maintain a separate hardcoded
// product→HS-code guess table — that would be Avocore inventing a classification
// independent of the authoritative source. Instead this sends the product's own
// category/name as a keyword to USITC's real search endpoint and scores confidence
// from how specific/consistent the real results are. If USITC returns nothing, or
// returns too many unrelated matches to pick one confidently, this returns
// requiresHumanReview: true — Avocore never silently picks a code on a guess.

export interface HtsCandidate {
  htsNumber: string;
  description: string;
  generalRatePercent: number | null; // null when the line is a heading/no rate itself
  rawIndent: number;
}

export interface HsClassificationResult {
  bestMatch: HtsCandidate | null;
  alternatives: HtsCandidate[];
  confidence: number; // 0-100
  requiresHumanReview: boolean;
  query: string;
  rawResultCount: number;
}

const USITC_SEARCH_URL = "https://hts.usitc.gov/reststop/search";

// Parses USITC's published rate strings ("Free", "2.5%", "5.3¢/kg + 4%") into a
// single representative percent where possible. Compound/specific (non-ad-valorem)
// rates cannot be reduced to one clean percent — those are intentionally left null
// rather than guessed, and the caller must treat null as "requires broker
// confirmation," never as 0%.
function parseGeneralRate(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^free$/i.test(trimmed)) return 0;
  const pctMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (pctMatch) return parseFloat(pctMatch[1]);
  return null; // compound/specific rate — cannot reduce to a clean percent
}

export async function classifyProduct(rawKeyword: string): Promise<HsClassificationResult> {
  // Strip parenthetical pack/size info and generic set/count phrasing before
  // searching — "Magnetic Cable Organizer Clips (6-Pack)" should search as
  // "Magnetic Cable Organizer Clips," not include "(6-Pack)" which adds noise with
  // no classification value.
  const keyword = rawKeyword
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(set of \d+|pack of \d+|\d+-pack)\b/gi, "")
    .trim();

  const url = `${USITC_SEARCH_URL}?keyword=${encodeURIComponent(keyword)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`USITC HTS search failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as Array<{
    htsno?: string;
    description?: string;
    general?: string;
    indent?: string;
  }>;

  const candidates: HtsCandidate[] = (data ?? [])
    .filter((row) => row.htsno && row.htsno.trim().length > 0) // rows without an htsno are section/chapter headers, not classifiable lines
    .map((row) => ({
      htsNumber: row.htsno!.trim(),
      description: row.description ?? "",
      generalRatePercent: parseGeneralRate(row.general),
      rawIndent: row.indent ? parseInt(row.indent, 10) || 0 : 0,
    }));

  if (candidates.length === 0) {
    return {
      bestMatch: null,
      alternatives: [],
      confidence: 0,
      requiresHumanReview: true,
      query: keyword,
      rawResultCount: 0,
    };
  }

  // Real bug found during live testing, fixed here: picking withRates[0] (array
  // order) matched a "Cable Clips" product to the "Asses" (livestock) tariff line —
  // pure incidental word overlap with no actual relevance ranking. Instead, score
  // each candidate by how many of the search keyword's own words appear in its HTS
  // description, and prefer the highest-overlap match. This is still a heuristic
  // (not a substitute for human classification — hence requiresHumanReview below a
  // confidence threshold), but it's now actually reasoning about relevance instead
  // of accepting whatever the API happened to return first.
  const keywordWords = keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const withRates = candidates.filter((c) => c.generalRatePercent !== null);
  function overlapScore(c: HtsCandidate): number {
    const descWords = c.description.toLowerCase();
    return keywordWords.filter((w) => descWords.includes(w)).length;
  }
  const ranked = [...withRates].sort((a, b) => overlapScore(b) - overlapScore(a));
  const bestMatch = ranked[0] ?? candidates[0];
  const bestOverlap = bestMatch ? overlapScore(bestMatch) : 0;

  // Confidence now reflects actual relevance (word overlap with the real HTS
  // description), not just how many rows the API returned.
  let confidence: number;
  if (withRates.length === 0) {
    confidence = 15;
  } else if (bestOverlap >= 2) {
    confidence = 75;
  } else if (bestOverlap === 1) {
    confidence = 45;
  } else {
    confidence = 20; // no keyword word actually appears in the matched description — likely a false positive
  }

  const alternatives = ranked.filter((c) => c !== bestMatch).slice(0, 5);

  return {
    bestMatch,
    alternatives,
    confidence,
    requiresHumanReview: confidence < 50,
    query: keyword,
    rawResultCount: candidates.length,
  };
}
