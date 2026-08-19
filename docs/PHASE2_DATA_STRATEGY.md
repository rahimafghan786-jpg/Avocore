# Phase 2 Data Strategy

This document is the required deliverable before any real-provider code is written. It audits
every existing MOCK provider interface against real, currently-accessible U.S. data sources, then
recommends exactly one starting point and states plainly what blocks the rest.

**Research basis**: findings below are grounded in live web research conducted August 2026, not
assumed from training data — API terms, pricing, and access models change fast enough that
guessing would be irresponsible for a document whose whole purpose is accuracy.

---

## Provider-by-provider audit

### 1. MarketplaceProvider (`searchListings`, `getListingReviews`, `estimateFees`, `estimateAdCost`)

1. **Needs**: comparable listings (price, seller count, review count/rating, estimated sales),
   per-listing reviews, marketplace fee schedule, advertising cost of sales.
2. **Currently MOCK**: all of it — every number is seeded-random, deterministic per candidate.
3. **Real source options**: Amazon SP-API (Catalog Items, Product Pricing APIs); eBay Buy Browse
   API; Walmart Marketplace API; third-party aggregators (Keepa, Jungle Scout, Helium10 — paid
   resellers of Amazon data).
4. **Official API?** Amazon: yes (SP-API). eBay: yes (Buy Browse API). Walmart: yes (Marketplace
   API, seller-only).
5. **Licensed alternative?** Keepa (~$50-200/mo depending on tier), Jungle Scout (~$49+/mo),
   Helium10 (~$39+/mo) — all paid subscriptions reselling Amazon data under license.
6. **API limitations**:
   - **Amazon SP-API requires an active Professional Seller account** ($39.99/mo) to even
     register as a developer, plus role-based approval per data category, plus (as of 2026) new
     usage-based billing on top of the seller subscription. Critically, SP-API's Catalog/Pricing
     endpoints are scoped to *browsing catalog data*, not competitor sales volume — Amazon does
     not expose other sellers' actual unit sales through any public API, mock or otherwise.
   - **eBay Buy Browse API**: free, self-service developer signup, no business verification
     required, 5,000 calls/day default (raisable via a free "Application Growth Check" request).
     Returns real current listings — title, price, condition, seller info, item location — but
     **no sales-volume or demand figure**, only "watchers" on some listings.
   - **Walmart Marketplace API**: seller-only, same structural issue as Amazon (requires an
     active Walmart seller account).
7. **Cost**: Amazon — seller subscription $39.99/mo + new GET-call billing (rolled out April
   2026). eBay — free at this scale. Walmart — requires seller account (no published dev-only
   fee, but gated behind seller approval). Keepa/Jungle Scout/Helium10 — $39-200+/mo.
8. **Geographic coverage**: all four are US-marketplace-scoped by default (good fit — Phase 1's
   `market: "US"` constraint already matches).
9. **Marketplace coverage**: each API only covers its own platform — no cross-marketplace source
   exists. Confirms the spec's instruction that adding a marketplace is a provider swap, not a
   rewrite.
10. **Fields legally storable**: current listing price, title, condition, seller name/location,
    category, item specifics — all public storefront data, generally fine to cache with
    attribution. Review *text* from eBay/Amazon typically falls under each platform's API terms
    restricting redistribution/display outside the authorized app context — needs a per-platform
    ToS read before storing raw review text long-term, not just before launch.
11. **Fields NOT legally storable**: buyer PII, other sellers' account-level data, anything
    requiring a seller's own OAuth grant (that data belongs to the seller, not Avocore).
12. **Rate limits**: eBay 5,000/day default (workable for Avocore's per-run call volume — a
    handful of calls per research run). Amazon varies by endpoint and by the new 2026 billing
    tier.
13. **If unavailable**: provider falls back to `MOCK` classification automatically (see
    Normalization Strategy below) — never silently substitutes stale/cached data as if fresh.

**Verdict: eBay Buy Browse API is the only option in this category with zero cost and zero
business-verification requirement.** It does not provide demand/sales-volume — see the Search/
Demand section below for how that gap is labeled, not filled with a guess.

---

### 2. SearchProvider (`getSearchVolume`)

1. **Needs**: monthly search volume + trend direction for a product term.
2. **Currently MOCK**: fully seeded-random.
3. **Real source options**: Google Ads Keyword Planner API (requires an active Google Ads
   account with spend history to get real numbers, not ranges), Google Trends API (official,
   but see below), third-party keyword tools (Ahrefs, Semrush — paid).
4. **Official API?** Google Ads Keyword Planner: yes, but access without an active ad account
   with spend returns only broad volume *ranges*, not real numbers — a known Google Ads
   limitation, not a bug.
5. **Licensed alternative?** Semrush/Ahrefs APIs — paid, $100+/mo tier for API access.
6. **API limitations**: Keyword Planner needs Google Ads OAuth + an account; free-tier real
   numbers are effectively unavailable without ad spend.
7. **Cost**: Semrush/Ahrefs API access starts well above hobbyist budget.
8. **Geographic coverage**: US available on all options.
9. **Marketplace coverage**: N/A (search, not marketplace-specific).
10-11. **Storable fields**: aggregate search volume numbers are generally fine to store;
    per-keyword competitor bid data from Ads Keyword Planner has usage restrictions tied to the
    Ads account it came from.
12. **Rate limits**: Google Ads API has daily operation quotas tied to account tier.
13. **If unavailable**: MOCK fallback, same pattern as above.

**Verdict: no zero-cost, zero-account option exists for real search volume.** This stays MOCK
until either Zayd has an active Google Ads account (even $0-spend accounts get *some* API access
tiers) or budget opens up for Semrush/Ahrefs.

---

### 3. TrendProvider (`getTrend`)

1. **Needs**: trend classification (emerging/established/seasonal/viral/declining/noise).
2. **Currently MOCK**.
3. **Real source options**: Google Trends (official API is application-gated alpha as of August
   2026 — announced July 2025, still not open to general signup a year later); third-party Trends
   resellers (SerpApi has a free tier, DataForSEO is cheapest per-call, Glimpse adds absolute-
   volume enrichment).
4. **Official API?** Technically yes, practically no — the alpha waitlist has not opened to
   general developers as of this research.
5. **Licensed alternative?** SerpApi's free tier is the most realistic zero-cost path if the
   official alpha stays closed.
6. **Limitations**: Google Trends (official or unofficial) only ever returns *relative* interest
   (0-100 scaled), never absolute search volume — any source claiming absolute numbers from
   Trends data is overstating what the underlying data actually is.
7. **Cost**: SerpApi free tier exists; paid tiers scale from there.
8-9. **Coverage**: US available.
10-11. **Storable**: relative interest scores are fine to store and cite; must always be labeled
    "relative interest," never "search volume," per point 6.
12. **Rate limits**: SerpApi free tier is call-capped (low hundreds/month typically).
13. **If unavailable**: MOCK fallback.

**Verdict: SerpApi's free tier is a realistic secondary target after eBay, if this becomes the
second real provider** — but not the first, since it only adds relative-trend context, not the
core demand+competition picture Amazon/eBay Browse-style data would carry.

---

### 4. SocialProvider (`getComplaintSignals`)

1. **Needs**: recurring complaint patterns from public discussion (Reddit, TikTok, forums).
2. **Currently MOCK**.
3. **Real source options**: Reddit's official API (free tier exists, has become considerably more
   restricted and now requires commercial licensing above certain usage for for-profit apps as of
   recent policy changes), no comparable official TikTok public-content API for this use case.
4-5. **Official/licensed**: Reddit API — official, free tier available for low-volume,
   non-commercial-scale reads; commercial terms apply above that.
6. **Limitations**: platform ToS on scraping/automated collection is genuinely restrictive here —
   this is exactly the kind of source Claude should not help build a workaround for if it crosses
   into unauthorized scraping.
7. **Cost**: Reddit free tier viable at low volume; commercial tier pricing varies.
8-9. **Coverage**: global, filterable to US-relevant subreddits.
10-11. **Storable**: aggregated complaint *themes*, not verbatim large-scale reproduction of
    user posts (both a ToS and a copyright consideration).
12. **Rate limits**: Reddit free tier has strict per-minute request caps.
13. **If unavailable**: MOCK fallback.

**Verdict: not the first target.** Real complaint-signal analysis is valuable but structurally
harder to source cleanly (ToS-restrictive) than marketplace listing data — defer until after the
first provider proves the real-data pipeline works end to end.

---

### 5. SupplierProvider (`findSuppliers`)

1. **Needs**: candidate suppliers (name, country, MOQ, price at MOQ/500, lead time, verification
   status).
2. **Currently MOCK**.
3. **Real source options**: Alibaba (no public supplier-search API for third-party apps —
   commercial partnership required), Global Sources, ThomasNet (US domestic manufacturers,
   directory-style, no public search API either).
4-5. **Official/licensed**: none of the major B2B sourcing platforms expose a public,
   self-service API for supplier search at Avocore's scale.
6. **Limitations**: this entire category is effectively closed to a self-service integration —
   every viable source requires a business partnership agreement, not a signup form.
7-13: N/A — no accessible option currently exists.

**Verdict: stays MOCK for the foreseeable future.** This is not a "we haven't gotten to it yet"
gap — it's a structural one. Flag as `DATA GAP` in every opportunity's evidence, exactly as the
spec requires, rather than implying it's coming soon.

---

### 6. TariffProvider (`lookupDuty`)

1. **Needs**: HTS code + duty rate for a product/origin-country pair.
2. **Currently MOCK**.
3. **Real source options**: USITC's official HTS lookup (free, public, no API key — but is a
   *lookup tool*, not a clean REST API; the underlying data is published and technically
   scrapable from a government public-data source, which is a different legal posture than
   scraping a commercial platform).
4. **Official API?** No formal REST API, but the HTS schedule itself is public U.S. government
   data.
5. **Licensed alternative?** Customs brokers' paid tariff-lookup tools (Flexport, Freightos) —
   more usable APIs, paid.
6. **Limitations**: HTS classification is genuinely ambiguous for many products and legally
   consequential if wrong — this is exactly why Phase 1's mock provider already flags
   `requiresBrokerConfirmation: true` on every result. A real integration should keep that
   flag, always.
7. **Cost**: USITC data itself is free; Flexport/Freightos APIs are paid, business-tier.
8-9. **Coverage**: US import tariffs specifically — good fit.
10-11. **Storable**: published tariff schedule data is public and storable; per-shipment quotes
    from a broker's API would carry that broker's own terms.
12. **Rate limits**: N/A for public government data (reasonable-use expectations apply).
13. **If unavailable**: MOCK fallback, `requiresBrokerConfirmation: true` always retained
    regardless of source.

**Verdict: a legitimate secondary target** — the underlying data is public U.S. government data,
not a paid commercial license, which makes it more accessible than most categories here. Not
first, because it's only useful once a supplier country/product is already established.

---

### 7. RegulatoryProvider (`assessCategory`)

1. **Needs**: regulatory risk score + required agencies for a category (CPSC, FDA, FCC, etc.).
2. **Currently MOCK** (keyword-matched against a small hardcoded list).
3. **Real source options**: CPSC's public recall/requirements database, FDA's public product
   classification database — both free, public U.S. government sources.
4-5. **Official/licensed**: public government data, not commercially licensed.
6. **Limitations**: same as tariff — regulatory classification is legally consequential, and a
   real integration must preserve (never remove) Phase 1's "STOP AND VERIFY with a qualified
   professional" language. This is a place where overclaiming certainty is a real harm, not just
   a quality issue.
7. **Cost**: free (public data).
8-9. **Coverage**: US federal only.
10-11. **Storable**: public regulatory data, freely storable.
12. **Rate limits**: reasonable-use, no hard API quota typically enforced on these government
    lookup tools.
13. **If unavailable**: MOCK fallback, "STOP AND VERIFY" language always retained.

**Verdict: viable secondary target**, same reasoning as tariff — free public data, but only
useful as a supplement once a real product/category pipeline exists.

---

### 8. ShippingProvider (`estimateFreight`)

1. **Needs**: cost-per-unit and transit days for a given origin country / weight / quantity.
2. **Currently MOCK**.
3. **Real source options**: freight forwarder APIs (Freightos, Flexport) — quote aggregators,
   paid/business-tier.
4-5. **Official/licensed**: no free public freight-rate API exists; rates are inherently
   quote-based and carrier/route-specific.
6. **Limitations**: freight rates are genuinely volatile and quote-based — even a "real"
   integration would be an *estimate* from a rate aggregator, never a firm price.
7. **Cost**: business-tier API pricing for Freightos/Flexport.
8-13: N/A — no free-tier option currently exists.

**Verdict: stays MOCK.** No accessible path without a business account.

---

## Summary table

| Provider | Real free-tier option? | First-provider candidate? |
|---|---|---|
| Marketplace | ✅ eBay Buy Browse API | **Yes — recommended first** |
| Search (volume) | ❌ none accessible | No — stays MOCK |
| Trend | ⚠️ SerpApi free tier (limited) | Possible second |
| Social | ⚠️ Reddit free tier (restricted ToS) | Not yet — ToS-sensitive |
| Supplier | ❌ none accessible | No — structural `DATA GAP` |
| Tariff | ⚠️ public USITC data, no clean API | Possible secondary |
| Regulatory | ⚠️ public CPSC/FDA data, no clean API | Possible secondary |
| Shipping | ❌ none accessible | No — stays MOCK |

---

## First real data target: eBay Buy Browse API

Answers "what's actually listed and selling on eBay right now for this product" with real
current listing price, seller count, condition, and item location. Does **not** answer demand
(no sales-volume field) — that gap gets an explicit `dataStatus: "MOCK"` sub-field, not a filled-in
guess, per the Core Principle.

### What this requires from Zayd before any code is written

**A free eBay Developer account and API credentials — something only Zayd can create, since it
requires agreeing to eBay's API terms as the account holder.** Steps:
1. Sign up at developer.ebay.com (free, no business verification)
2. Create an application to get an **App ID (Client ID)** and **Cert ID (Client Secret)**
3. Use the free Client Credentials OAuth flow (no per-user login needed for Browse API's
   public-search use case)

Once those two credentials exist, they'd be added as `EBAY_APP_ID` / `EBAY_CERT_ID` environment
variables, the same pattern already used for Supabase.

---

## Normalization strategy (real → existing brain)

Real provider output feeds into the exact same `Evidence`-shaped interfaces Phase 1 already
uses — no second scoring/decision path. Every real evidence item adds two fields beyond what
mock evidence already carries:

```ts
interface Evidence {
  // ...existing fields (classification, claim, confidence, etc.) unchanged...
  dataStatus: "MOCK" | "OBSERVED" | "ESTIMATED" | "VERIFIED" | "INFERRED"; // supersedes classification for real providers
  retrievedAt: string; // already exists as collectedAt — real providers populate it with the actual fetch timestamp, not a synthetic one
  coverage?: string; // e.g. "eBay US listings only — not cross-marketplace"
  limitations?: string; // e.g. "no sales-volume data available from this endpoint"
}
```

`MarketplaceProvider.searchListings()` gets a second implementation,
`EbayMarketplaceProvider`, registered in `providers/registry.ts` behind an environment check
(`EBAY_APP_ID` present → real; absent → mock), exactly matching the pattern
`registry.ts`'s existing comment already describes for Phase 2 swaps. Zero changes to
`agents/`, `contradiction-engine.ts`, `scoring-engine.ts`, or `decision-engine.ts` — they consume
`Evidence`-shaped data and don't care where it came from.

## Evidence strategy

Real eBay data gets classified `OBSERVED` (directly observed from a live source, not derived) for
price/listing-count fields, since that's an accurate description — not `VERIFIED`, which Phase 1
reserves for authoritative/confirmed sources, a bar eBay's public listings don't clear on their
own (a listing price is real but not independently verified against, say, a signed contract).

## Failure handling

If the eBay API call fails, times out, or hits a rate limit: the provider throws, the caller
catches it, and **falls back to the existing mock provider for that call only** — never a partial
real result silently blended with mock without labeling. This mirrors the exact fallback pattern
already proven in `run-store.ts` this session (try real, catch, fall back, log why).

## Mock → real migration strategy

One provider method at a time. `searchListings()` first (the core "what's for sale, at what
price, how many sellers" question). `getListingReviews()` stays mock initially — eBay's
Browse API doesn't expose review text at all, so real review data isn't available from this
source regardless.

## Data freshness

`retrievedAt` timestamp on every real evidence item. No caching layer in this first pass — every
research run makes a fresh call. If Phase 2.5 later adds caching for rate-limit management, the
cache age becomes part of `limitations`, not hidden.

## Confidence model

Real `OBSERVED` eBay data gets a **higher** confidence baseline than the equivalent mock evidence
(e.g., 75 vs. the mock provider's 62 for listing data) — it's real, but eBay-only, not
cross-marketplace, so still capped well below `VERIFIED`-tier confidence (90+).

## Compliance considerations

eBay's API License Agreement permits this exact use case (displaying/using listing data within an
authorized application) but restricts bulk redistribution of eBay data outside the app and
requires eBay attribution where listing data is shown. Both requirements are compatible with
Avocore's existing "Source: [name]" evidence display pattern — no UI change needed, just ensure
the source name reads "eBay" accurately rather than a generic label.
