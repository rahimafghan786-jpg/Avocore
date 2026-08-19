import { ProviderRegistry, ProviderStatus, RegulatoryProvider, TariffProvider } from "@/domain/provider";
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

// Phase 2A: CPSC and USITC are real by default (both are free, official, no API key
// required — there's no "not configured" state to gate behind, unlike Supabase/eBay).
// Real failures fall back to mock automatically via the wrappers above.
// Phase 1 providers still cover everything else. Swap one line at a time as Phase 2B
// sources come online — nothing in agents/ or lib/ needs to change when a provider
// is swapped.
export const providers: ProviderRegistry = {
  marketplace: new MockMarketplaceProvider(),
  search: new MockSearchProvider(),
  trend: new MockTrendProvider(),
  social: new MockSocialProvider(),
  supplier: new MockSupplierProvider(),
  tariff: new TariffProviderWithFallback(new UsitcTariffProvider(), new MockTariffProvider()),
  regulatory: new RegulatoryProviderWithFallback(new CpscRegulatoryProvider(), new MockRegulatoryProvider()),
  shipping: new MockShippingProvider(),
};

export const providerStatuses: ProviderStatus[] = [
  { key: "marketplace", label: "Marketplace (Amazon/Walmart)", connected: false, plannedPhase: "Phase 2B" },
  { key: "search", label: "Search Volume", connected: false, plannedPhase: "Phase 2B" },
  { key: "trend", label: "Trend (Google Trends)", connected: false, plannedPhase: "Phase 2B" },
  { key: "social", label: "Social Signals (Reddit/TikTok/etc.)", connected: false, plannedPhase: "Phase 3" },
  { key: "supplier", label: "Supplier Directory", connected: false, plannedPhase: "Phase 3" },
  { key: "tariff", label: "Tariff / HTS Lookup (USITC, live)", connected: true, plannedPhase: "Phase 2A — live" },
  { key: "regulatory", label: "Regulatory Assessment (CPSC, live)", connected: true, plannedPhase: "Phase 2A — live" },
  { key: "shipping", label: "Freight / Shipping", connected: false, plannedPhase: "Phase 3" },
];
