# Real Data Source Map

This document answers one question: **what is the smallest combination of legitimate real data
sources that would make Avocore genuinely useful for finding U.S. product opportunities** —
not which single API is easiest to connect first. Research conducted live, August 2026; API
terms in this space shift fast enough that anything older should be re-verified before acting on
it.

---

## AMAZON — reassessed precisely, not dismissed wholesale

Amazon has **three** distinct API surfaces, and they answer different questions. Conflating them
was the error in the earlier "dead end" framing — here's the precise breakdown:

**SP-API (Selling Partner API)** — for sellers managing their *own* inventory/orders/pricing.
Requires an active Professional Seller account ($39.99/mo) to even register as a developer, plus
per-category role approval, plus new 2026 usage-based billing. **Cannot** answer "what's the
market demand for a product I don't sell" — it's an operations API, not a market-research API,
by design. Confirmed dead end for Avocore's actual question.

**PA-API (Product Advertising API)** — for Associates (affiliates) to pull product data
(price, images, reviews count, catalog info) to display on their own site. This *can* answer
market-research-style questions (what does this product cost, how many reviews does it have).
**But**: as of 2026, Amazon requires **10 qualifying affiliate sales in the trailing 30 days**
just to activate and *maintain* access — up from a 1-sale requirement previously. This is a
chicken-and-egg problem for a startup with no existing affiliate traffic. Also: PA-API itself is
being retired (deprecated May 15, 2026) in favor of a new **Creators API** with unclear/evolving
requirements — actively unstable ground to build on right now.

**Licensed third-party resellers** (Canopy API, Keepa, Jungle Scout, Helium10) — these companies
have their own commercial agreements/scraping infrastructure and resell Amazon catalog/pricing
data via a normal API-key signup, no affiliate sales requirement. Canopy: 100 free requests/month,
$0.01/request after. Keepa/Jungle Scout/Helium10: $39-200+/mo subscriptions with API access at
higher tiers.

**Conclusion**: Amazon market intelligence is possible, but only through a **paid licensed
reseller**, not a free official path. This is real, it's just not free. Tier 2, not Tier 5.

---

## WALMART — same structure as Amazon, one more wrinkle

**Marketplace API** — seller-only, same dead-end shape as Amazon SP-API (requires an active
Walmart seller account).

**Content Provider / Affiliate API** — read-only catalog + pricing access for affiliates,
*does not* require a sales threshold like Amazon's PA-API, but Walmart's own documentation states
approval "requires a solid business case" and is described as "selective." Free to apply, gated
by discretionary approval rather than a hard metric — worth attempting, outcome uncertain.

**Conclusion**: no free, self-serve, guaranteed-approval option exists. Tier 3 (partnership/
approval required) until proven otherwise by actually applying.

---

## GOOGLE / SEARCH — four distinct sources, not one

**Google Trends (official API)**: announced July 2025, still an **application-gated alpha** a
year later — not open to general signup. **pytrends** (the unofficial library) was archived/
unmaintained as of April 2025. Third-party resellers (SerpApi, DataForSEO, Glimpse) fill the gap
today; SerpApi has a usable free tier. Even when accessible, Trends data is *relative interest*
(0-100), never absolute search volume — must always be labeled as such.

**Google Ads Keyword Planner API**: official, requires a Google Ads account; **accounts without
active ad spend get only broad volume ranges, not real numbers** — a documented Google limitation,
not a workaround-able bug. Real numbers require actual ad spend history.

**Google Search Console API**: free, official — but only exposes search data for domains *you
own and have verified*, useless for researching products you don't yet sell (same shape problem
as SP-API).

**Google Shopping (Content API for Shopping)**: for merchants to list products in Google Shopping
results — again a "manage your own listings" API, not a market-research API.

**Conclusion**: no free, no-account real demand-volume source exists from Google today. SerpApi's
free tier is the most viable near-term option, and only for relative trend direction, not volume.
Tier 2 (SerpApi) / Tier 5 (everything else in this category, for Avocore's specific need).

---

## SUPPLIERS — direct vs. marketplace, as requested

**Direct supplier data** (Alibaba, Global Sources, manufacturer directories): **no public
self-service API exists for supplier search** on any major B2B sourcing platform. Alibaba has no
public third-party search API — commercial partnership only. Global Sources: same shape. This
entire category requires a business relationship, not a signup form, full stop.

**U.S. domestic manufacturers/wholesalers** (ThomasNet and similar directories): browsable
directories, no public search API for third-party integration either.

**Marketplace supplier data** (i.e., inferring supplier existence from Amazon/eBay listings
showing "sold by X, ships from China"): this is *indirect* — you learn a product has *some*
supply chain, not the supplier's actual MOQ/price/terms. Real, but much weaker evidence than
direct supplier contact.

**Conclusion**: direct supplier data is genuinely Tier 5 (not viable) for a self-service
integration at Avocore's current stage. This isn't a research gap — it's a structural fact about
how B2B sourcing platforms operate. The honest fallback: marketplace listing data (once a real
marketplace provider exists) gives *indirect* supply-chain signal, better than nothing, clearly
labeled as inferred rather than direct.

---

## GOVERNMENT DATA — the strongest, most underused category

This is where the audit changes the most from the first pass. All of these are **free, official,
no business account required**, and in most cases **no approval process at all** — just an
optional or trivial API key:

**U.S. Census Bureau International Trade API**: free, official, self-serve API key (instant),
REST/JSON. Provides actual U.S. import/export values by HS code, country, month, going back to
2013. This directly answers "import/export flows," "trade flows," and materially strengthens
tariff/landed-cost evidence — real government trade-value data, not an estimate.

**USITC DataWeb**: free, official, U.S. trade and tariff data, more detailed HTS-level breakdowns
than Census alone; API access available.

**CPSC Recalls API (saferproducts.gov)**: fully free, **no API key required at all**, official
REST endpoint, JSON/XML, recall data back to 1973 — brand names, hazards, UPCs, injury data. This
directly replaces Phase 1's current mock `RegulatoryProvider`, which only does keyword matching
against a small hardcoded list, with a genuinely authoritative source.

**openFDA API**: free, official, optional API key (higher rate limit with one), covers FDA
recall/enforcement data back to 2004 — relevant for any product touching cosmetics, supplements,
food-adjacent categories.

**Conclusion**: this is the single strongest tier in this whole analysis. Free, no approval,
authoritative, directly relevant to two of Avocore's existing provider interfaces
(`TariffProvider`, `RegulatoryProvider`). This should be prioritized **above** any marketplace
integration, not after it — it's genuinely free and improves the two providers where getting
something wrong (a regulatory or tariff claim) carries the most real-world consequence.

---

## Full category-by-category source table

| # | Category | Best real source | Tier | Self-serve? | Cost |
|---|---|---|---|---|---|
| 1 | Search demand | SerpApi (Trends proxy) | 2 | Yes (free tier) | Free tier → paid |
| 2 | Marketplace demand | eBay Browse API (listings only, no volume) | 1 | Yes | Free |
| 3 | Sales velocity | None free; Amazon via Keepa/Jungle Scout | 2 | Paid signup | $39-200+/mo |
| 4 | Competition (seller count) | eBay Browse API | 1 | Yes | Free |
| 5 | Pricing | eBay Browse API; licensed Amazon resellers | 1/2 | Yes / Paid | Free / Paid |
| 6 | Price history | Keepa (Amazon-specific, this is Keepa's core product) | 2 | Paid | $50+/mo |
| 7 | Reviews | Not available via eBay Browse; licensed resellers for Amazon | 2 | Paid | Paid |
| 8 | Customer complaints | Reddit API (free tier, ToS-restricted at scale) | 3 | Yes, limited | Free tier |
| 9 | Product trends | SerpApi | 2 | Yes (free tier) | Free tier → paid |
| 10 | Social trends | Reddit API | 3 | Yes, limited | Free tier |
| 11 | Supplier availability | None self-service | 5 | No | N/A |
| 12 | Supplier pricing | None self-service | 5 | No | N/A |
| 13 | MOQ | None self-service | 5 | No | N/A |
| 14 | Freight | None free; Freightos/Flexport | 3 | Business tier | Paid |
| 15 | Tariffs | USITC DataWeb, Census Trade API | **1** | Yes | Free |
| 16 | Duties | USITC DataWeb | **1** | Yes | Free |
| 17 | Regulations | CPSC Recalls API, openFDA | **1** | Yes (no key needed for CPSC) | Free |
| 18 | Marketplace fees | Published fee schedules (Amazon/eBay/Walmart all publish these) | 1 | Yes (static docs) | Free |
| 19 | Advertising economics | No clean source; inferable from ACoS benchmarks in industry reports | 4 | N/A | N/A |
| 20 | Returns | No clean source | 4 | N/A | N/A |
| 21 | Seasonality | SerpApi Trends (time series) | 2 | Yes (free tier) | Free tier |
| 22 | Geographic demand | Census Trade API (by district/port); Trends (by region) | 1/2 | Yes | Free |
| 23 | Wholesale opportunities | None self-service | 5 | No | N/A |
| 24 | B2B demand | None self-service | 5 | No | N/A |
| 25 | Import/export flows | **Census Bureau International Trade API** | **1** | Yes | Free |

---

## Tier summary

**TIER 1 — highest value, easiest legitimate access (free, self-serve, no approval):**
- eBay Buy Browse API (marketplace listings/price/competition)
- U.S. Census Bureau International Trade API (import/export flows, tariff context)
- USITC DataWeb (tariffs/duties)
- CPSC Recalls API (regulatory — no key even required)
- openFDA (regulatory, FDA-adjacent categories)
- Published marketplace fee schedules (static reference data, not really an "API" but real and free)

**TIER 2 — high value, requires account or paid provider:**
- SerpApi free tier (trend/search direction)
- Canopy API or Keepa/Jungle Scout/Helium10 (licensed Amazon data)
- Google Ads Keyword Planner (requires an Ads account, real numbers need spend history)

**TIER 3 — partnership/licensing/approval required, outcome uncertain:**
- Walmart Content Provider/Affiliate API (discretionary approval)
- Reddit API at meaningful scale (commercial licensing above free-tier volume)
- Freightos/Flexport (business-tier freight quotes)

**TIER 4 — future opportunity, no clear path yet:**
- Advertising economics benchmarks (no clean API; would need industry report synthesis)
- Return-rate data (no clean source at all currently identified)

**TIER 5 — not viable / prohibited / insufficient for self-service integration:**
- Amazon SP-API (for market research use case specifically — it's fine for actual sellers)
- Amazon PA-API (sales-threshold chicken-and-egg problem, plus being deprecated)
- Walmart Marketplace API (seller-only)
- Direct supplier sourcing (Alibaba, Global Sources, ThomasNet — no public search API on any of them)
- Google Trends official API (still gated alpha)
- Google Search Console (own-domain only)

---

## The minimum real data stack for Avocore MVP

Answering your actual question directly: the smallest combination that makes Avocore genuinely
useful is **three free, self-serve sources**, not one:

1. **eBay Buy Browse API** — real marketplace listings: price, seller count, condition.
   Answers demand/competition/pricing (categories 2, 4, 5) at the marketplace level.
2. **CPSC Recalls API** — real regulatory evidence, replacing keyword-matching with actual
   recall history. Answers category 17, and meaningfully improves the one area (regulatory
   risk) where a wrong mock guess carries genuine consequence.
3. **U.S. Census Bureau International Trade API** — real import/export value data by HS code
   and country. Answers categories 15, 16, 25, and strengthens landed-cost evidence beyond a
   random tariff-rate mock.

**Why this combination and not eBay alone**: eBay alone (the original recommendation) only
touches one axis — marketplace listings. It leaves tariff/regulatory evidence exactly as mock as
before. These three together touch marketplace, regulatory, and trade/tariff simultaneously —
three of Avocore's eight provider interfaces move from MOCK to real, using entirely free,
no-approval sources, before a single dollar is spent or a single business account is opened.

**What stays MOCK after this stack, honestly**: search volume (no free real source), supplier
data (structurally closed), freight rates (business-tier only), social/complaint signals
(ToS-restrictive at scale), advertising economics, and return rates. That's still five of eight
providers remaining mock — this stack is a real, meaningful step, not a complete Phase 2.

---

## Recommended Phase 2 sequence

1. **CPSC Recalls API first** — not eBay. Smallest integration surface (no auth even needed),
   highest consequence-of-being-wrong category, and it's a clean drop-in replacement for the
   existing keyword-match `RegulatoryProvider` with no architecture change.
2. **Census Bureau International Trade API second** — strengthens `TariffProvider`, same
   reasoning: free, no auth beyond an instant key, high-consequence category.
3. **eBay Buy Browse API third** — the marketplace/demand/competition layer, requiring an actual
   developer account (still free, but a real signup step, unlike the two government APIs above).
4. Reassess after those three are live and tested before touching Tier 2 (paid) sources.

This sequence front-loads the zero-cost, zero-approval, highest-consequence sources, and treats
the marketplace provider as the *third* step, not the first — directly addressing the concern
that Avocore was at risk of becoming "an eBay tool" by default.
