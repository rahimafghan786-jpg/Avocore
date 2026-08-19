# Avocore — Architecture (Phase 1)

## What Phase 1 is

Avocore is an AI commerce intelligence platform. Phase 1 builds the **functional foundation**:
one real end-to-end workflow — "$2,000 → find opportunities → investigate → challenge → decide" —
running on realistic mock data, with an architecture that lets each mock provider be swapped for a
real one later without touching business logic.

Phase 1 explicitly does **not** implement all 37 agents from the original spec, and does **not**
connect to any live marketplace, supplier, tariff, or social API. It implements the orchestration
skeleton (Master Agent → Research Plan → parallel specialist agents → Evidence Engine →
Contradiction Check → Scoring → Decision) with ~10 specialist agents that are enough to produce one
excellent, defensible recommendation. See `ROADMAP.md` for what's deliberately deferred.

## Layered structure

```
src/
  app/                     Next.js routes (UI pages + API routes). No business logic here.
    page.tsx               Command Center
    chat/                  AI Chat interface
    research/               Product Research screen (opportunity list)
    opportunities/[id]/     Opportunity Detail screen
    evidence/               Evidence Center
    settings/               Settings / Data Providers
    api/chat/route.ts       POST endpoint that runs the Master Agent

  domain/                  Pure TypeScript types/contracts. No logic, no I/O.
    evidence.ts            Evidence, Source, Classification, Confidence
    agent.ts               AgentResult, Risk, Recommendation, ActionPlan
    opportunity.ts         Opportunity, OpportunityScore, Decision
    financial.ts           Financial model input/output shapes
    provider.ts            Provider interfaces (Marketplace, Search, Trend, Social,
                            Supplier, Tariff, Regulatory, Shipping)

  providers/               Data provider implementations behind the domain interfaces.
    registry.ts            Central provider registry (mock today, live later — one line to swap)
    mock/                  Mock implementations + a small seeded demo product catalog

  agents/                  Specialist agents. Each agent is a pure function:
                            (ProviderRegistry, AgentInput) -> Promise<AgentResult>
                            Agents call providers, never invent numbers, and attach Evidence
                            to every factual claim they make.

  lib/
    evidence-engine.ts      Collects, classifies, and timestamps evidence from agent results
    contradiction-engine.ts Detects conflicting specialist signals and writes the "why" narrative
    scoring-engine.ts        Transparent, configurable weighted opportunity score
    financial-engine.ts      Landed cost, margins, breakeven, ROI, capital requirements
    decision-engine.ts       GO / TEST / INVESTIGATE / WAIT / REJECT — rule-based, not an average
    master-agent.ts          Orchestrator: Research Plan -> parallel agents -> evidence ->
                              contradiction check -> scoring -> financial -> decision
    request-parser.ts        Turns a free-text chat message into structured research parameters
    anthropic.ts              Optional Claude call used only to narrate/explain results in
                              natural language. Never used to invent evidence or numbers.

  db/
    schema.sql / migrations  See DATABASE.md
    supabase/                Client wiring (browser + server), not yet connected to a live project
```

## Why this shape

- **UI never touches business logic.** Pages call API routes; API routes call `lib/master-agent.ts`.
- **Agents never call external services directly.** They call provider interfaces. This is what lets
  Phase 2 swap `MockMarketplaceProvider` for a real Amazon SP-API provider with zero changes to any
  agent or engine.
- **The LLM (Claude) is not the source of truth.** Structured data comes from providers → agents →
  engines, all deterministic TypeScript. Claude's only job in Phase 1 is (a) parsing loose natural
  language into structured research parameters, and (b) narrating an already-computed, already-
  evidenced result in plain English. This matches the spec's rule: *"Do not allow the LLM to
  directly invent database values."* If `ANTHROPIC_API_KEY` is not set, the app still runs — it
  falls back to a deterministic parser and a template-based narrative, so the whole pipeline is
  testable without any API key.
- **Contradiction check is a real reasoning step, not a hidden average.** `contradiction-engine.ts`
  runs *before* scoring and can force a `REJECT` even when the weighted score looks decent — e.g.
  high demand + poor margin + high ad dependency for a beginner with $2,000 gets flagged and
  overridden, with the reasoning shown to the user. See `SCORING.md`.

## Request flow (the one milestone workflow)

1. User sends: *"I have $2,000. I live in the USA. I have no e-commerce experience. Find me five
   product opportunities."*
2. `app/api/chat/route.ts` calls `request-parser.ts` → structured `ResearchRequest`
   (`{ capital: 2000, market: "US", experience: "beginner", count: 5 }`).
3. `master-agent.ts` builds a **Research Plan**: which specialist agents run, over which candidate
   products (drawn from the mock catalog in `providers/mock/seed-data.ts`).
4. Specialist agents run **in parallel** per candidate product (`Promise.all`), each calling its
   provider(s) and returning an `AgentResult` with attached `Evidence[]`.
5. `evidence-engine.ts` collects all evidence, stamps classification (`MOCK` / `ESTIMATED` /
   `OBSERVED` / `INFERRED` / `VERIFIED`) and freshness.
6. `contradiction-engine.ts` looks for known conflict patterns (high demand + poor margin, high
   demand + high ad dependency + low capital, etc.) and produces a plain-English "why" note.
7. `financial-engine.ts` computes landed cost, margin, breakeven, and capital required.
8. `scoring-engine.ts` computes a transparent, weighted `OpportunityScore` — shown in full, never
   hidden.
9. `decision-engine.ts` combines the score with the contradiction findings and capital constraints
   to output one of `GO / TEST / INVESTIGATE / WAIT / REJECT`, with a required "why" and required
   evidence references.
10. The top N opportunities are returned to the UI, each fully labeled with evidence classification
    and confidence, never presented as guaranteed.

## Explicit non-goals for Phase 1

- No real Amazon / Walmart / Costco / TikTok / trend / supplier / tariff data.
- No 37-agent execution. Ten specialist agents cover the one milestone workflow end to end.
- No persistence to a live Supabase project yet (schema + client code are ready; wiring is a Phase 2
  step once a project exists — see `ROADMAP.md`).
- No fake "Connect Amazon" buttons that don't do anything. Unbuilt integrations are shown in
  Settings as **Not Connected — Mock Data Active**, never as if they work.

## Decision hierarchy (Phase 1.5 addition)

`decide()` in `decision-engine.ts` applies these in strict order — each step can only narrow the
decision further, never loosen it back up:

1. **Forced contradiction** (`forcesDecision` set, e.g. `LANDED_COST_TRAP`) → that decision,
   full stop. Nothing downstream can override this.
2. **Minimum-viable-capital gate** — if even a 10-unit test doesn't fit available capital → WAIT.
3. **Score-based baseline** — 80+/60+/40+/below-40 → GO/TEST/INVESTIGATE/REJECT.
4. **Capped contradictions** (`capsDecision` set, e.g. `LOW_CONFIDENCE`) → decision can only move
   DOWN toward REJECT from here, never up.
5. **User Fit gate** — `userFitScore < 35` caps at INVESTIGATE, same direction-only rule.

Steps 1 and 5 are HARD GATES; step 3 is the only SCORED step. This is the structural guarantee
that a high demand score cannot override a CRITICAL contradiction: gates run before and after
scoring, and can only pull the decision down, never up. See `SCORING.md` "Hard Gates vs. Scored
Factors" and `domain/user-fit.ts` for the full User Fit model.
