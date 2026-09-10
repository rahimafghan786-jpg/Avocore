import { ProviderRegistry, ProviderStatus, RegulatoryProvider, TariffProvider, TrendProvider } from "@/domain/provider";
import { MockMarketplaceProvider } from "./mock/marketplace.provider";
import { MockSearchProvider } from "./mock/search.provider";
import { MockTrendProvider } from "./mock/trend.provider";
import { MockSocialProvider } from "./mock/social.provider";
import { MockSupplierProvider } from "./mock/supplier.provider";
import { MockTariffProvider } from "./mock/tariff.provider";
import { MockRegulatoryProvider } from "./mock/regulatory.provider";
import { MockShippingProvider } from "./mock/shipping.provider";
import { CpscRegulatoryProvider } from "./real/cpsc.provider";
import { UsitcTariffProvider } from "./real/usitc-tariff.provider";
import { EbayListingSearchProvider } from "./real/ebay-marketplace.provider";
import { AmazonCatalogSearchProvider } from "./real/amazon-marketplace.provider";
import { CompositeMarketplaceProvider, NamedMarketplaceSearchSource } from "./real/composite-marketplace.provider";
import { SerpApiTrendProvider } from "./real/serpapi-trend.provider";

// Real-with-fallback wrappers (Phase 2A). Each tries the real provider first; if it
// throws (network error, source down, unexpected response shape), the error is
// logged and the mock provider serves the request instead — the app stays usable,
// but the fallback is never silent: the returned evidence's `claim` is explicitly
// prefixed so it's visible everywhere the claim text is rendered (Evidence Center,
// opportunity detail page, etc.), not buried in a field nothing displays.
class RegulatoryProviderWithFallback implements RegulatoryProvider {
  constructor(private real: RegulatoryProvider, private mock: RegulatoryProvider) {}
  async assessCategory(category: string, productName?: string) {
    try {
      return await this.real.assessCategory(category, productName);
    } catch (err) {
      console.error("Real RegulatoryProvider (CPSC) failed, falling back to mock:", err);
      const fallback = await this.mock.assessCategory(category, productName);
      return { ...fallback, claim: `[REAL DATA UNAVAILABLE — USING MOCK DATA] ${fallback.claim}` };
    }
  }
}

class TariffProviderWithFallback implements TariffProvider {
  constructor(private real: TariffProvider, private mock: TariffProvider) {}
  async lookupDuty(htsGuess: string, originCountry: string) {
    try {
      return await this.real.lookupDuty(htsGuess, originCountry);
    } catch (err) {
      console.error("Real TariffProvider (USITC) failed, falling back to mock:", err);
      const fallback = await this.mock.lookupDuty(htsGuess, originCountry);
      return { ...fallback, claim: `[REAL DATA UNAVAILABLE — USING MOCK DATA] ${fallback.claim}` };
    }
  }
}

class TrendProviderWithFallback implements TrendProvider {
  constructor(private real: TrendProvider, private mock: TrendProvider) {}
  async getTrend(term: string, market: "US") {
    try {
      return await this.real.getTrend(term, market);
    } catch (err) {
      console.error("Real TrendProvider (SerpApi) failed, falling back to mock:", err);
      const fallback = await this.mock.getTrend(term, market);
      return { ...fallback, claim: `[REAL DATA UNAVAILABLE — USING MOCK DATA] ${fallback.claim}` };
    }
  }
}

// Phase 2A: CPSC and USITC are real by default (both are free, official, no API key
// required — there's no "not configured" state to gate behind, unlike Supabase/eBay/Amazon).
// Phase 2B: marketplace search combines every configured real source (eBay, Amazon) —
// see composite-marketplace.provider.ts. Each source activates independently as its
// credentials are added; falls back to mock (visibly labeled) only if none are configured
// or all configured sources fail on a given call.
const ebaySource: NamedMarketplaceSearchSource = {
  name: "eBay",
  isConfigured: () => Boolean(process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID),
  searchListings: (query) => new EbayListingSearchProvider().searchListings(query),
};

const amazonSource: NamedMarketplaceSearchSource = {
  name: "Amazon",
  isConfigured: () =>
    Boolean(
      process.env.AMAZON_CLIENT_ID && process.env.AMAZON_CLIENT_SECRET && process.env.AMAZON_REFRESH_TOKEN
    ),
  searchListings: (query) => new AmazonCatalogSearchProvider().searchListings(query),
};

export const providers: ProviderRegistry = {
  marketplace: new CompositeMarketplaceProvider([ebaySource, amazonSource], new MockMarketplaceProvider()),
  search: new MockSearchProvider(),
  trend: new TrendProviderWithFallback(new SerpApiTrendProvider(), new MockTrendProvider()),
  social: new MockSocialProvider(),
  supplier: new MockSupplierProvider(),
  tariff: new TariffProviderWithFallback(new UsitcTariffProvider(), new MockTariffProvider()),
  regulatory: new RegulatoryProviderWithFallback(new CpscRegulatoryProvider(), new MockRegulatoryProvider()),
  shipping: new MockShippingProvider(),
};

export const providerStatuses: ProviderStatus[] = [
  {
    key: "marketplace",
    label: "Marketplace (eBay + Amazon, live per source)",
    connected: ebaySource.isConfigured() || amazonSource.isConfigured(),
    plannedPhase: [
      ebaySource.isConfigured() ? "eBay: live" : "eBay: needs EBAY_APP_ID/EBAY_CERT_ID",
      amazonSource.isConfigured()
        ? "Amazon: live"
        : "Amazon: needs AMAZON_CLIENT_ID/AMAZON_CLIENT_SECRET/AMAZON_REFRESH_TOKEN",
      "Walmart: structurally blocked (seller-only API)",
      "Costco: not applicable (no marketplace API)",
    ].join(" · "),
  },
  { key: "search", label: "Search Volume", connected: false, plannedPhase: "Phase 2B" },
  {
    key: "trend",
    label: "Trend (Google Trends via SerpApi, live)",
    connected: Boolean(process.env.SERPAPI_KEY),
    plannedPhase: "Phase 2B — live if SERPAPI_KEY set, else mock fallback",
  },
  { key: "social", label: "Social Signals (Reddit/TikTok/etc.)", connected: false, plannedPhase: "Phase 3" },
  { key: "supplier", label: "Supplier Directory", connected: false, plannedPhase: "Phase 3" },
  { key: "tariff", label: "Tariff / HTS Lookup (USITC, live)", connected: true, plannedPhase: "Phase 2A — live" },
  { key: "regulatory", label: "Regulatory Assessment (CPSC, live)", connected: true, plannedPhase: "Phase 2A — live" },
  { key: "shipping", label: "Freight / Shipping", connected: false, plannedPhase: "Phase 3" },
];
