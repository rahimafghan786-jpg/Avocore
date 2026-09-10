import { ListingResult } from "@/domain/provider";
import { randomUUID } from "crypto";

// Real provider: Amazon Selling Partner API (SP-API), Catalog Items endpoint. Per
// docs/PHASE2_DATA_STRATEGY.md: SP-API's Catalog/Pricing endpoints are scoped to *browsing
// catalog data* (title, price, category) — Amazon does not expose competitor sales-volume
// or unit-sales figures through any public API, mock or otherwise. This provider therefore
// leaves estimatedMonthlySales/rating/reviewCount unset, exactly like the eBay provider,
// rather than estimating them.
//
// Activation requires the account owner to already hold an active Amazon Professional
// Seller account ($39.99/mo) and to have registered an SP-API application — this is a
// business decision, not something Claude can do on someone's behalf. Required env vars:
//   AMAZON_CLIENT_ID       — SP-API app's LWA client ID
//   AMAZON_CLIENT_SECRET   — SP-API app's LWA client secret
//   AMAZON_REFRESH_TOKEN   — long-lived refresh token from the seller's self-authorization
//   AMAZON_MARKETPLACE_ID  — defaults to ATVPDKIKX0DER (Amazon.com / US) if unset

export const AMAZON_SOURCE = {
  id: "src-amazon-spapi-catalog",
  name: "Amazon SP-API Catalog Items (official, sellercentral-apis.amazon.com)",
  url: "https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-v2022-04-01-reference",
  providerKey: "marketplace",
};

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const SPAPI_BASE_URL = "https://sellingpartnerapi-na.amazon.com";
const DEFAULT_MARKETPLACE_ID = "ATVPDKIKX0DER"; // Amazon.com (US)

interface LwaTokenResponse {
  access_token: string;
  expires_in: number;
}

interface CatalogItemSummary {
  marketplaceId: string;
  brandName?: string;
  itemName?: string;
}

interface CatalogItem {
  asin: string;
  summaries?: CatalogItemSummary[];
}

interface CatalogSearchResponse {
  items?: CatalogItem[];
}

interface PricingOfferSummary {
  Asin?: string;
  LowestPrice?: { ListingPrice?: { Amount?: number } };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.AMAZON_CLIENT_ID;
  const clientSecret = process.env.AMAZON_CLIENT_SECRET;
  const refreshToken = process.env.AMAZON_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "AMAZON_CLIENT_ID / AMAZON_CLIENT_SECRET / AMAZON_REFRESH_TOKEN are not configured."
    );
  }
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Amazon LWA token refresh failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as LwaTokenResponse;
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

// Only implements the "search comparable listings" half of MarketplaceProvider — see the
// file-level comment. Reviews, fee schedules, and ad cost stay on the mock provider,
// composed in registry.ts, matching the same one-method-at-a-time migration approach used
// for eBay.
export class AmazonCatalogSearchProvider {
  async searchListings(query: string): Promise<ListingResult[]> {
    const token = await getAccessToken();
    const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || DEFAULT_MARKETPLACE_ID;

    const searchUrl = `${SPAPI_BASE_URL}/catalog/2022-04-01/items?keywords=${encodeURIComponent(
      query
    )}&marketplaceIds=${marketplaceId}&includedData=summaries&pageSize=10`;

    const searchRes = await fetch(searchUrl, {
      headers: { "x-amz-access-token": token, Accept: "application/json" },
    });
    if (!searchRes.ok) {
      throw new Error(`Amazon Catalog Items search failed: HTTP ${searchRes.status}`);
    }
    const searchData = (await searchRes.json()) as CatalogSearchResponse;
    const items = searchData.items ?? [];

    if (items.length === 0) {
      throw new Error(`Amazon Catalog returned zero items for "${query}" — nothing to observe.`);
    }

    const topItems = items.slice(0, 5);

    // Pricing is a separate SP-API call (Product Pricing API), fetched per-ASIN. If pricing
    // fails for an individual item, that item still returns with price omitted rather than
    // failing the whole batch — a missing price on one listing shouldn't hide four good ones.
    const pricingByAsin = await fetchPricing(
      token,
      topItems.map((i) => i.asin),
      marketplaceId
    );

    const collectedAt = new Date().toISOString();

    return topItems.map((item) => {
      const summary = item.summaries?.[0];
      const title = summary?.itemName ?? item.asin;
      const price = pricingByAsin.get(item.asin);

      return {
        id: randomUUID(),
        dataType: "demand",
        classification: "OBSERVED",
        claim:
          price !== undefined
            ? `Amazon's catalog lists "${title}" (ASIN ${item.asin}) at $${price.toFixed(
                2
              )}. SP-API's Catalog/Pricing endpoints do not expose competitor sales-volume — this is real catalog/price data only, not a demand estimate.`
            : `Amazon's catalog lists "${title}" (ASIN ${item.asin}). Price could not be retrieved for this item; SP-API's Catalog/Pricing endpoints never expose competitor sales-volume regardless.`,
        value: price,
        unit: price !== undefined ? "USD" : undefined,
        source: AMAZON_SOURCE,
        collectedAt,
        freshnessNote: "Live read of the Amazon SP-API Catalog Items endpoint.",
        confidence: price !== undefined ? 78 : 60,
        query,
        rawReference: `https://www.amazon.com/dp/${item.asin}`,
        listingId: item.asin,
        title,
        price: price ?? 0,
        estimatedMonthlySales: undefined,
        rating: undefined,
        reviewCount: undefined,
        sellerCount: undefined,
        dominantBrandShare: undefined,
        assumptions: [
          "Amazon SP-API provides no sales-volume, demand, seller-count, or review data through any endpoint — those fields are intentionally left unset rather than estimated.",
          summary?.brandName ? `Listed brand: ${summary.brandName}.` : "Brand not returned by the catalog summary.",
        ],
      } satisfies ListingResult;
    });
  }
}

async function fetchPricing(
  token: string,
  asins: string[],
  marketplaceId: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (asins.length === 0) return result;

  try {
    const url = `${SPAPI_BASE_URL}/products/pricing/v0/items/${asins[0]}/offers?MarketplaceId=${marketplaceId}&ItemCondition=New`;
    // SP-API pricing is per-ASIN; batching all ASINs here would need N calls. For a Phase 2B
    // first pass, only the top result's price is fetched live to keep call volume low —
    // remaining items show without a price rather than making 5x the API calls per search.
    const res = await fetch(url, { headers: { "x-amz-access-token": token, Accept: "application/json" } });
    if (res.ok) {
      const data = (await res.json()) as { payload?: { Summary?: PricingOfferSummary } };
      const amount = data.payload?.Summary?.LowestPrice?.ListingPrice?.Amount;
      if (typeof amount === "number") {
        result.set(asins[0], amount);
      }
    }
  } catch (err) {
    console.error("Amazon pricing lookup failed for top item (non-fatal):", err);
  }
  return result;
}
