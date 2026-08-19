# Avocore — Roadmap

## Phase 1 — Functional foundation (this build)

- Next.js + TypeScript app, Tailwind
- Supabase schema written and migration-ready (not yet connected to a live project)
- Auth scaffolding (Supabase Auth, email magic link) — wired but needs a live project + env vars
- Command Center, AI Chat, Product Research, Opportunity Detail, Evidence Center, Settings/Data
  Providers pages
- Master Agent orchestration: Research Plan → 10 parallel specialist agents → Evidence Engine →
  Contradiction Check → Scoring → Financial → Decision
- 8 provider interfaces, all backed by realistic mock data, clearly labeled `MOCK`
- One milestone workflow working end to end: "$2,000, USA, no experience, find 5 opportunities" →
  5 fully-evidenced opportunities, each with a GO/TEST/INVESTIGATE/WAIT/REJECT and a "why"
- Kill List and Opportunity Radar screens exist and read from the same run data (Radar alerts are
  simulated on top of the mock catalog for now — no live monitoring yet)
- Research runs persisted to a local JSON file (not in-memory) so results are consistent across
  Next.js's isolated request-handling threads — see `DATABASE.md`

**Explicitly not in Phase 1:** the other 27 agents from the original spec, real marketplace/
supplier/tariff/social integrations, ZIP-level regional analysis, B2B opportunity discovery,
learning-loop (predicted vs. actual), multi-country expansion.

## Phase 1.5 — Make it persistent (small, mechanical)

- Provision a real Supabase project
- Wire `master-agent.ts` output into the tables in `DATABASE.md` instead of the in-memory cache
- Real Supabase Auth (currently scaffolded, not load-bearing)
- Row-level security policy review

## Phase 2 — First real integrations, one at a time

Order matters — do these one at a time, verify each before starting the next:

1. Amazon SP-API (authorized, OAuth) — catalog, offers, fees, and the user's own seller data only
2. Google Trends / a real search-volume provider
3. Trade/tariff data provider (HTS lookup, duty rates)
4. Supplier research provider (starts as a semi-manual RFQ workflow, per the spec's Supplier
   Negotiation Agent, before any "verified supplier database" claim is made)
5. Walmart Marketplace API (authorized)

Each integration replaces exactly one line in `providers/registry.ts`. If an integration can't
reach `VERIFIED` confidence (e.g. a supplier that only has a website, no documents/samples checked),
it stays labeled accordingly — never silently upgraded.

## Phase 3 — Breadth

- Remaining specialist agents from the original 37 (Regional Opportunity, B2B Opportunity, Retail
  Gap, Pricing, Inventory, Listing Optimization, Marketing, etc.), added one at a time, each with
  its own provider interface + mock-first rollout
- Social signal providers (Reddit, TikTok, Pinterest, YouTube) where terms of service allow
- Opportunity Radar becomes a real background job (not simulated) once there's live data to monitor

## Phase 4 — Execution & learning loop

- Product Testing tracking (actual cost, actual sales, actual returns)
- Predicted vs. Actual comparison, prediction-error tracking, and score-model adjustment
- This is the proprietary learning loop from the original spec — it only makes sense once Phase 2/3
  integrations are live and there's real outcome data to learn from

## Later — global expansion

Canada → Mexico → Brazil → Latin America → Europe → Middle East → Asia → Central Asia, per the
original spec's long-term vision. The provider abstraction and `market: "US"` parameterization in
Phase 1 are deliberately shaped so this is a matter of adding providers/markets, not a rewrite.

## Guardrail for every phase

Before adding a new agent or provider: does it serve the one milestone workflow better, or is it
scope expansion for its own sake? If the answer isn't obviously "better," it waits.
