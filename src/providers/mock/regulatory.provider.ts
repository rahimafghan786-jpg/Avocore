import { RegulatoryProvider, RegulatoryAssessment } from "@/domain/provider";
import { seededRandom, randInt } from "./seeded-random";
import { makeSource, makeEvidence } from "./evidence-helpers";

const HIGH_RISK_KEYWORDS: Record<string, string[]> = {
  "baby": ["CPSC", "ASTM F963"],
  "pet electronics": ["CPSC", "FCC (if wireless/rechargeable)"],
  "electronics": ["CPSC", "FCC"],
  "cosmetics": ["FDA"],
  "supplement": ["FDA"],
  "food": ["FDA", "USDA"],
};

export class MockRegulatoryProvider implements RegulatoryProvider {
  async assessCategory(category: string): Promise<RegulatoryAssessment> {
    const rand = seededRandom(`regulatory-${category}`);
    const source = makeSource("regulatory", "Mock Regulatory Assessment Provider");
    const key = Object.keys(HIGH_RISK_KEYWORDS).find((k) => category.toLowerCase().includes(k));
    const requiredAgencies = key ? HIGH_RISK_KEYWORDS[key] : [];
    const isHighRisk = !!key;
    const riskScore = isHighRisk ? randInt(rand, 62, 88) : randInt(rand, 5, 30);

    return {
      ...makeEvidence({
        dataType: "regulatory",
        claim: isHighRisk
          ? `The "${category}" category commonly involves ${requiredAgencies.join(
              " / "
            )} requirements. This needs confirmation with a qualified professional before sourcing.`
          : `No major regulatory red flags detected for the "${category}" category in Avocore's mock beginner-risk screen.`,
        value: riskScore,
        unit: "risk score (0-100)",
        source,
        confidence: isHighRisk ? 55 : 65,
        assumptions: ["Keyword-based mock screen, not a substitute for legal/regulatory review."],
      }),
      category,
      riskScore,
      requiredAgencies,
      requiresStopAndVerify: isHighRisk,
    };
  }
}
