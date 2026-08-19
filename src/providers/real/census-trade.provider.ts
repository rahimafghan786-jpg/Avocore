import { Evidence, Source } from "@/domain/evidence";
import { randomUUID } from "crypto";

// STATUS: code-complete, NOT wired into the pipeline, NOT tested against a live
// response. The U.S. Census Bureau International Trade API requires a free,
// instant, self-serve API key — but it is a real credential that only Zayd can
// obtain (agreeing to Census's terms as the account holder), the same reason
// Supabase/eBay credentials couldn't be fabricated earlier this project. Until
// CENSUS_API_KEY is set, this module is inert — nothing calls it, and it must not
// be reported as VERIFIED.
//
// IMPORTANT DISTINCTION this provider must preserve: trade VALUE (dollars of goods
// imported/exported for an HS code) is a market-SUPPLY signal, not a consumer-DEMAND
// signal. High import volume means a lot of a product is entering the country — it
// does NOT mean consumers are buying it in high volume. Every evidence item this
// provider produces is worded to keep that distinction explicit, per the instruction
// that "high import volume does not automatically mean high consumer demand."

const SOURCE: Source = {
  id: "src-census-trade",
  name: "U.S. Census Bureau International Trade API (official)",
  url: "https://www.census.gov/foreign-trade/",
  providerKey: "trade",
};

export interface TradeFlowResult extends Evidence {
  hsCode: string;
  tradeValueUsd: number;
  tradeDirection: "import" | "export";
  periodMonth: string; // e.g. "2026-06"
}

export async function getTradeContext(hsCode: string, month: string): Promise<TradeFlowResult> {
  const apiKey = process.env.CENSUS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CENSUS_API_KEY is not set. Get a free key at https://api.census.gov/data/key_signup.html — this cannot be fabricated, it requires Zayd's own signup."
    );
  }

  const [year, monthNum] = month.split("-");
  const url =
    `https://api.census.gov/data/timeseries/intltrade/imports/hs` +
    `?get=I_COMMODITY,I_COMMODITY_LDESC,GEN_VAL_MO,CTY_NAME` +
    `&I_COMMODITY=${encodeURIComponent(hsCode)}&YEAR=${year}&MONTH=${monthNum}&key=${apiKey}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Census Trade API request failed: HTTP ${res.status}`);
  }
  const rows = (await res.json()) as string[][];
  // First row is the header; sum GEN_VAL_MO across country rows for a total.
  const [header, ...dataRows] = rows;
  const valueIdx = header.indexOf("GEN_VAL_MO");
  const descIdx = header.indexOf("I_COMMODITY_LDESC");
  const totalValue = dataRows.reduce((sum, row) => sum + (parseFloat(row[valueIdx]) || 0), 0);
  const description = dataRows[0]?.[descIdx] ?? hsCode;

  return {
    id: randomUUID(),
    dataType: "tariff", // closest existing DataType; a dedicated "trade_flow" type would be a clean Phase 2B addition
    classification: "OBSERVED",
    claim: `U.S. imports under HS code ${hsCode} (${description}) totaled $${totalValue.toLocaleString()} in ${month}. This reflects trade volume — the quantity of goods entering the country — not consumer purchase demand. A high value here means substantial supply is being imported, which is a market-supply signal, not proof that end consumers are buying it in proportion.`,
    value: totalValue,
    unit: "USD",
    source: SOURCE,
    collectedAt: new Date().toISOString(),
    freshnessNote: `Official U.S. Census Bureau monthly trade statistics for ${month}.`,
    confidence: 90, // government trade statistics are about as authoritative as evidence gets
    query: `HS ${hsCode}, ${month}`,
    hsCode,
    tradeValueUsd: totalValue,
    tradeDirection: "import",
    periodMonth: month,
    assumptions: [
      "Trade value reflects import volume/supply, not consumer demand — never treat this as a sales or demand figure.",
    ],
  };
}
