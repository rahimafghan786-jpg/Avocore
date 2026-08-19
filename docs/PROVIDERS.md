# Avocore — Data Providers (Phase 1)

## Principle

No agent, and no UI page, ever calls an external API or hard-codes a data source. Everything goes
through an interface in `src/domain/provider.ts`, resolved at runtime by `src/providers/registry.ts`.
Today every provider resolves to a mock implementation. Swapping one provider for a real integration
is a one-line change in the registry — nothing in `agents/` or `lib/` changes.

## Interfaces (Phase 1)

```ts
interface MarketplaceProvider {
  searchListings(query: string, market: "US"): Promise<ListingResult[]>;
  getListingReviews(listingId: string): Promise<ReviewResult[]>;
  estimateFees(listingPrice: number, category: string): Promise<FeeEstimate>;
  estimateAdCost(category: string): Promise<AdCostEstimate>;
}

interface SearchProvider {
  getSearchVolume(term: string, market: "US"): Promise<SearchVolumeResult>;
}

interface TrendProvider {
  getTrend(term: string, market: "US"): Promise<TrendResult>;
}

interface SocialProvider {
  getComplaintSignals(topic: string): Promise<ComplaintSignal[]>;
}

interface SupplierProvider {
  findSuppliers(productCategory: string, country?: string): Promise<SupplierResult[]>;
}

interface TariffProvider {
  lookupDuty(htsGuess: string, originCountry: string): Promise<TariffResult>;
}

interface RegulatoryProvider {
  assessCategory(category: string): Promise<RegulatoryAssessment>;
}

interface ShippingProvider {
  estimateFreight(originCountry: string, unitWeightKg: number, quantity: number): Promise<FreightEstimate>;
}
```

Every result type includes `source`, `collectedAt`, and `classification` — see
`domain/evidence.ts`. A provider is not allowed to return a bare number; it returns an `Evidence`-
shaped object.

## Mock providers (Phase 1, active now)

Located in `src/providers/mock/`. Backed by a small seeded catalog
(`providers/mock/seed-data.ts`) of realistic demo products with plausible-but-fabricated numbers,
each explicitly stamped `classification: "MOCK"`. The UI never lets a MOCK number be mistaken for a
real one (see the `EvidenceBadge` component).

Mock data is intentionally *realistic in shape* (real fee percentages, real HTS-style formats, real
freight math) so that swapping in live data later doesn't change any downstream calculation logic —
only where the input numbers come from.

## Registry

```ts
// src/providers/registry.ts
export const providers: ProviderRegistry = {
  marketplace: new MockMarketplaceProvider(),
  search: new MockSearchProvider(),
  trend: new MockTrendProvider(),
  social: new MockSocialProvider(),
  supplier: new MockSupplierProvider(),
  tariff: new MockTariffProvider(),
  regulatory: new MockRegulatoryProvider(),
  shipping: new MockShippingProvider(),
};
```

Phase 2 swaps one line, e.g.:

```ts
marketplace: process.env.AMAZON_SP_API_CLIENT_ID
  ? new AmazonMarketplaceProvider(spApiConfig)
  : new MockMarketplaceProvider(),
```

## Settings / Data Providers screen

Shows each provider's current status: **Mock Data Active** or **Connected (live)**. Never shows a
"Connect" button that doesn't do anything real — until a real OAuth/API integration exists for a
provider, its row is informational only, with a short note on what Phase it's planned for.

## Phase 2A — real providers (live as of this phase)

### CPSC Recalls Provider (`providers/real/cpsc.provider.ts`)
- **Source**: U.S. Consumer Product Safety Commission, official REST API at `saferproducts.gov/RestWebServices/Recall`
- **Purpose**: real regulatory risk evidence, replacing keyword-matched mock data
- **Fields returned**: recall count, matched recall numbers, hazard names, one example title, source URL
- **Authentication**: none — genuinely no API key required
- **Cost**: free
- **Rate limits**: none documented/enforced as of this writing
- **Freshness**: live query on every request, no caching
- **Fallback**: on any network/parse error, falls back to the Phase 1 mock `RegulatoryProvider`; the fallback result's `claim` is prefixed `[REAL DATA UNAVAILABLE — USING MOCK DATA]`, visible everywhere the claim renders
- **Evidence classification**: `VERIFIED` on an actual recall match, `OBSERVED` on a confirmed no-match (a real query that legitimately returned zero rows)
- **CRITICAL behavior**: a no-match result is explicitly worded to never imply safety — "does not mean the category is safe," always
- **Known gap**: query matches on `ProductName` keyword against the category string (e.g. "Kitchen," "Outdoor") — broad categories can return many loosely-related recalls (confirmed live: "Outdoor" returned 90 matches). A future pass should match against the specific product name, not the broad category, for tighter relevance.

### USITC HTS Tariff Provider (`providers/real/usitc-tariff.provider.ts`)
- **Source**: U.S. International Trade Commission, official REST API at `hts.usitc.gov/reststop/search`
- **Purpose**: real duty-rate evidence for the landed-cost calculation, replacing a random 0-12% mock rate
- **Fields returned**: matched HTS number, description, general (MFN) duty rate, classification confidence, alternative candidates
- **Authentication**: none required
- **Cost**: free
- **Rate limits**: undocumented/unpublished by USITC; not observed to be hit at Avocore's per-run call volume
- **Freshness**: live query on every request
- **Fallback**: same pattern as CPSC — falls back to mock `TariffProvider` on failure, visibly marked
- **Classification logic** (`lib/hs-classifier.ts`): sends a cleaned product-name keyword to USITC's own search (never a hardcoded HS-code table), then ranks results by how many keyword words actually appear in the matched HTS description — not by array order. Confidence and `requiresHumanReview` are derived from that overlap score.
- **Real bug found and fixed during live testing**: the first version picked the first API result with a usable rate, regardless of relevance — this matched a "Magnetic Cable Organizer Clips" product to HTS **0101.30.00.00 ("Asses")**, the livestock tariff chapter, purely by array-order coincidence. Fixed by adding real relevance scoring; the regression is now a permanent unit test (`src/lib/__tests__/hs-classifier.test.ts`).
- **Known limitation**: the "general/MFN" rate returned does not include country-specific trade program rates (USMCA, GSP), Section 301/232 tariffs, or other overlays — `requiresBrokerConfirmation` is always `true` regardless of confidence, and this must not be removed.
- **Known gap**: `query`/`rawReference` provenance fields exist on the `Evidence` type and are populated in live API responses, but are not yet persisted to the Supabase `evidence` table (the insert mapping in `run-store.ts` wasn't updated for these two new columns). Fix is a small `run-store.ts` change plus a migration adding `query`/`raw_reference` columns to `evidence`.

### Census Trade Provider (`providers/real/census-trade.provider.ts`)
- **Status**: code-complete, **NOT wired into the pipeline, NOT tested**
- **Blocker**: requires `CENSUS_API_KEY`, a free but real credential only the account holder can obtain at `api.census.gov/data/key_signup.html`
- Distinguishes trade *value* (import/export dollars) from consumer *demand* explicitly in every evidence claim it produces — see the file's header comment for the reasoning.
