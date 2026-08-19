import { TariffProvider, TariffResult } from "@/domain/provider";
import { classifyProduct } from "@/lib/hs-classifier";
import { randomUUID } from "crypto";

const SOURCE = {
  id: "src-usitc-hts",
  name: "USITC Harmonized Tariff Schedule (official, hts.usitc.gov)",
  url: "https://hts.usitc.gov/",
  providerKey: "tariff",
};

// Real provider: queries the official USITC HTS REST API directly (no scraping, no
// API key). See docs/PROVIDERS.md for the exact endpoint and its documented behavior.
export class UsitcTariffProvider implements TariffProvider {
  async lookupDuty(htsGuess: string, originCountry: string): Promise<TariffResult> {
    // htsGuess here is actually a product keyword (category/name), not a pre-known
    // HTS code — classification happens against the real source, not a hardcoded map.
    const classification = await classifyProduct(htsGuess);

    if (!classification.bestMatch) {
      return {
        id: randomUUID(),
        dataType: "tariff",
        classification: "INFERRED",
        claim: `No matching HTS classification found for "${htsGuess}" in the official USITC schedule. Duty rate cannot be determined without a manual classification.`,
        source: SOURCE,
        collectedAt: new Date().toISOString(),
        confidence: 0,
        query: htsGuess,
        htsCodeGuess: "UNKNOWN",
        dutyRatePercent: 0,
        requiresBrokerConfirmation: true,
        classificationConfidence: 0,
        requiresHumanReview: true,
        assumptions: ["No USITC HTS search results matched this product description."],
      };
    }

    const { bestMatch, alternatives, confidence, requiresHumanReview } = classification;
    const rateKnown = bestMatch.generalRatePercent !== null;

    return {
      id: randomUUID(),
      dataType: "tariff",
      classification: "OBSERVED",
      claim: rateKnown
        ? `USITC HTS classification "${bestMatch.htsNumber}" (${bestMatch.description}) carries a general (MFN) duty rate of ${bestMatch.generalRatePercent}%. Classification confidence: ${confidence}/100.`
        : `USITC HTS classification "${bestMatch.htsNumber}" (${bestMatch.description}) has a compound or specific-rate duty structure that cannot be reduced to a single ad-valorem percent — requires broker confirmation for the actual duty owed.`,
      value: bestMatch.generalRatePercent ?? undefined,
      unit: "%",
      source: SOURCE,
      collectedAt: new Date().toISOString(),
      freshnessNote: "Live read of the current USITC Harmonized Tariff Schedule.",
      confidence,
      query: htsGuess,
      rawReference: `https://hts.usitc.gov/search?query=${encodeURIComponent(bestMatch.htsNumber)}`,
      htsCodeGuess: bestMatch.htsNumber,
      dutyRatePercent: bestMatch.generalRatePercent ?? 0,
      requiresBrokerConfirmation: true,
      classificationConfidence: confidence,
      alternativeHtsCodes: alternatives.map((a) => `${a.htsNumber} — ${a.description}`),
      requiresHumanReview,
      assumptions: [
        `Duty rate shown is the General (MFN) Column 1 rate only — does not reflect ${originCountry}-specific trade program rates, Section 301/232 tariffs, or other overlays that may apply.`,
        `Matched by keyword search against "${htsGuess}", not a confirmed classification for a specific shipment.`,
      ],
    };
  }
}
