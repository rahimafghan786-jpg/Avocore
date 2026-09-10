import { MarketplaceProvider, ListingResult } from "@/domain/provider";
import { randomUUID } from "crypto";

// Real provider: eBay Buy Browse API. Per docs/PHASE2_DATA_STRATEGY.md, this is the only
// zero-cost, zero-business-verification real marketplace source available. It answers
// "what's actually listed and selling on eBay right now, at what price" — it does NOT
// provide sales-volume/demand data (no such field exists in the Browse API response), so
// this provider deliberately leaves estimatedMonthlySales/rating/reviewCount unset rather
// than estimating them. Only searchListings() is real; getListingReviews, estimateFees, and
// estimateAdCost stay on the mock provider (see registry.ts composition), matching the
// "one provider method at a time" migration strategy documented in PHASE2_DATA_STRATEGY.md.

export const EBAY_SOURCE = {
  id: "src-ebay-browse",
  name: "eBay Buy Browse API (official, developer.ebay.com)",
  url: "https://developer.ebay.com/api-docs/buy/browse/overview.html",
  providerKey: "marketplace",
};

interface EbayTokenResponse {
  access_token: string;
  expires_in: number;
}

interface EbayItemSummary {
  itemId: string;
  title: string;
  price?: { value: string; currency: string };
  seller?: { username?: string; feedbackScore?: number };
  itemWebUrl?: string;
}

interface EbaySearchResponse {
  itemSummaries?: EbayItemSummary[];
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) {
    throw new Error("EBAY_APP_ID / EBAY_CERT_ID are not configured in the environment.");
  }
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const basicAuth = Buffer.from(`${appId}:${certId}`).toString("base64");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  if (!res.ok) {
    throw new Error(`eBay OAuth token request failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as EbayTokenResponse;
  // Refresh 60s before actual expiry to avoid using a token that expires mid-request.
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

// Only implements searchListings — see the file-level comment for why the other three
// MarketplaceProvider methods are intentionally not implemented here.
export class EbayListingSearchProvider {
  async searchListings(query: string): Promise<ListingResult[]> {
    const token = await getAccessToken();
    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(
      query
    )}&limit=10`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    });
    if (!res.ok) {
      throw new Error(`eBay Browse search failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as EbaySearchResponse;
    const items = data.itemSummaries ?? [];

    if (items.length === 0) {
      // No results is a real (if unhelpful) answer, but the caller's fallback wrapper
      // treats it the same as a failure — a mock candidate result is more useful to the
      // rest of the pipeline than an empty array, as long as it's clearly labeled.
      throw new Error(`eBay returned zero listings for "${query}" — nothing to observe.`);
    }

    const distinctSellers = new Set(items.map((i) => i.seller?.username).filter(Boolean)).size;
    const collectedAt = new Date().toISOString();

    return items.slice(0, 5).map((item) => {
      const price = item.price ? parseFloat(item.price.value) : 0;
      return {
        id: randomUUID(),
        dataType: "demand",
        classification: "OBSERVED",
        claim: `A live eBay US listing for "${item.title}" is currently priced at $${price.toFixed(
          2
        )}. eBay's Browse API does not expose sales-volume or demand figures — this is real price/listing data only, not a demand estimate.`,
        value: price,
        unit: "USD",
        source: EBAY_SOURCE,
        collectedAt,
        freshnessNote: "Live read of current eBay US listings via the Browse API.",
        confidence: 75,
        query,
        rawReference: item.itemWebUrl ?? `https://www.ebay.com/itm/${item.itemId}`,
        listingId: item.itemId,
        title: item.title,
        price,
        // Deliberately left undefined rather than estimated — see file-level comment.
        estimatedMonthlySales: undefined,
        rating: undefined,
        reviewCount: undefined,
        sellerCount: distinctSellers || undefined,
        dominantBrandShare: undefined,
        assumptions: [
          "eBay Browse API provides no sales-volume, demand, or review-count data — those fields are intentionally left unset rather than estimated.",
          `Seller count (${distinctSellers}) reflects only sellers visible on this single result page (up to 10 items), not the full marketplace.`,
        ],
      } satisfies ListingResult;
    });
  }
}

// Composite: real eBay for searchListings, mock for the other three MarketplaceProvider
// methods. Superseded by CompositeMarketplaceProvider for the marketplace-level composition
// in registry.ts, but kept as a simple single-source wrapper for direct testing.
export class MarketplaceProviderWithEbayFallback implements MarketplaceProvider {
  constructor(
    private real: EbayListingSearchProvider,
    private mock: MarketplaceProvider
  ) {}

  async searchListings(query: string, market: "US"): Promise<ListingResult[]> {
    try {
      return await this.real.searchListings(query);
    } catch (err) {
      console.error("Real MarketplaceProvider (eBay) failed, falling back to mock:", err);
      const fallback = await this.mock.searchListings(query, market);
      return fallback.map((l) => ({
        ...l,
        claim: `[REAL DATA UNAVAILABLE — USING MOCK DATA] ${l.claim}`,
      }));
    }
  }

  getListingReviews: MarketplaceProvider["getListingReviews"] = (listingId) =>
    this.mock.getListingReviews(listingId);

  estimateFees: MarketplaceProvider["estimateFees"] = (listingPrice, category) =>
    this.mock.estimateFees(listingPrice, category);

  estimateAdCost: MarketplaceProvider["estimateAdCost"] = (category) =>
    this.mock.estimateAdCost(category);
}
