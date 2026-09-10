import { TrendProvider, TrendResult } from "@/domain/provider";
import { randomUUID } from "crypto";

// Real provider: Google Trends via SerpApi. Google's own Trends API is still in a closed
// alpha with no public access as of this writing — SerpApi's free tier (100 searches/month)
// is the practical real-data path documented in docs/PHASE2_DATA_STRATEGY.md. Activation
// requires SERPAPI_KEY (free signup at serpapi.com, email only, no business verification).

const SOURCE = {
  id: "src-serpapi-trends",
  name: "Google Trends via SerpApi (serpapi.com)",
  url: "https://serpapi.com/google-trends-api",
  providerKey: "trend",
};

interface SerpApiTimelinePoint {
  values?: { value?: number; extracted_value?: number }[];
}

interface SerpApiTrendsResponse {
  interest_over_time?: {
    timeline_data?: SerpApiTimelinePoint[];
  };
}

function extractedValue(point: SerpApiTimelinePoint): number {
  const v = point.values?.[0];
  return (v?.extracted_value ?? v?.value ?? 0) as number;
}

// Classifies real interest-over-time data into the same categories the mock provider
// uses, so downstream agents/engines don't need to know whether the data is real or mock.
// Rules, in order:
// - Fewer than a handful of data points -> "noise" (not enough signal to say anything)
// - Recent values near zero after being nonzero -> "declining"
// - A single huge spike far above the rest of the series -> "viral_spike"
// - Consistent upward slope across the whole series -> "emerging"
// - Flat-ish with recurring peaks -> "seasonal" (approximated: high variance, no net trend)
// - Otherwise -> "established" (present, roughly steady)
export function classifyTrend(values: number[]): TrendResult["trendType"] {
  if (values.length < 4) return "noise";

  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const last3 = values.slice(-3);
  const first3 = values.slice(0, 3);
  const lastAvg = last3.reduce((a, b) => a + b, 0) / last3.length;
  const firstAvg = first3.reduce((a, b) => a + b, 0) / first3.length;

  if (max > mean * 3 && max === values[values.length - 1]) return "viral_spike";
  if (lastAvg < firstAvg * 0.4) return "declining";
  if (lastAvg > firstAvg * 1.6) return "emerging";

  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev > mean * 0.5) return "seasonal";

  return "established";
}

export class SerpApiTrendProvider implements TrendProvider {
  async getTrend(term: string): Promise<TrendResult> {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      throw new Error("SERPAPI_KEY is not configured.");
    }

    const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(
      term
    )}&geo=US&data_type=TIMESERIES&api_key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`SerpApi Google Trends request failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as SerpApiTrendsResponse;
    const points = data.interest_over_time?.timeline_data ?? [];

    if (points.length === 0) {
      throw new Error(`SerpApi returned no timeline data for "${term}" — nothing to classify.`);
    }

    const values = points.map(extractedValue);
    const trendType = classifyTrend(values);
    const latestValue = values[values.length - 1];

    return {
      id: randomUUID(),
      dataType: "trend",
      classification: "OBSERVED",
      claim: `Real Google Trends interest-over-time data for "${term}" (US) classifies as ${trendType}, based on ${values.length} data points with a current relative interest score of ${latestValue}/100.`,
      value: trendType,
      source: SOURCE,
      collectedAt: new Date().toISOString(),
      freshnessNote: "Live read of Google Trends via SerpApi's free tier.",
      confidence: values.length >= 8 ? 70 : 55,
      term,
      trendType,
      assumptions: [
        "Trend classification (emerging/declining/seasonal/etc.) is derived here from the raw interest-over-time series using simple slope and variance rules — Google Trends itself does not label a category, so this classification is Avocore's own interpretation of real data, not a value Google reports directly.",
      ],
    } satisfies TrendResult;
  }
}
