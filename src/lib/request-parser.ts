import { ResearchRequest } from "@/domain/opportunity";

const DEFAULT_CAPITAL = 2000;
const DEFAULT_COUNT = 5;

// Deterministic, dependency-free parser so the app works with zero external API keys.
// If ANTHROPIC_API_KEY is set, `lib/anthropic.ts` can be used upstream to normalize looser
// phrasing before this runs — but this parser alone is enough for the milestone workflow's
// phrasing ("I have $2,000... no e-commerce experience... find me five...").
export function parseResearchRequest(rawMessage: string): ResearchRequest {
  const capitalMatch = rawMessage.match(/\$\s?([\d,]+(?:\.\d+)?)/);
  const capital = capitalMatch ? parseFloat(capitalMatch[1].replace(/,/g, "")) : DEFAULT_CAPITAL;

  const countWords: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
  };
  let requestedCount = DEFAULT_COUNT;
  const digitCountMatch = rawMessage.match(/\b(\d{1,2})\b\s+(product\s+)?opportunit/i);
  if (digitCountMatch) {
    requestedCount = parseInt(digitCountMatch[1], 10);
  } else {
    const lower = rawMessage.toLowerCase();
    for (const [word, num] of Object.entries(countWords)) {
      if (lower.includes(`${word} product`) || lower.includes(`${word} opportunit`) || lower.includes(`find me ${word}`)) {
        requestedCount = num;
        break;
      }
    }
  }
  requestedCount = Math.max(1, Math.min(12, requestedCount)); // catalog currently has 9 candidates; 12 leaves headroom

  const lower = rawMessage.toLowerCase();
  let experienceLevel: ResearchRequest["experienceLevel"] = "beginner";
  if (lower.includes("experienced") || lower.includes("advanced") || lower.includes("years of e-commerce")) {
    experienceLevel = "advanced";
  } else if (lower.includes("some experience") || lower.includes("intermediate")) {
    experienceLevel = "intermediate";
  } else if (lower.includes("no experience") || lower.includes("beginner") || lower.includes("never sold")) {
    experienceLevel = "beginner";
  }

  // Risk tolerance: explicit statement wins if present; otherwise default by experience
  // level (a total beginner defaults to low risk tolerance unless they say otherwise —
  // an experienced seller defaults to moderate, not high, since "high" should be an
  // explicit choice, not an assumption).
  let riskTolerance: ResearchRequest["riskTolerance"] | null = null;
  if (lower.includes("low risk") || lower.includes("risk-averse") || lower.includes("risk averse") || lower.includes("cautious")) {
    riskTolerance = "low";
  } else if (lower.includes("high risk") || lower.includes("aggressive") || lower.includes("higher risk")) {
    riskTolerance = "high";
  } else if (lower.includes("moderate risk") || lower.includes("some risk")) {
    riskTolerance = "moderate";
  }
  if (!riskTolerance) {
    riskTolerance = experienceLevel === "beginner" ? "low" : experienceLevel === "intermediate" ? "moderate" : "moderate";
  }

  return {
    capital,
    market: "US",
    experienceLevel,
    riskTolerance,
    requestedCount,
    rawMessage,
  };
}
