# Avocore — Agents (Phase 1)

## Contract

Every agent is a pure async function with the same shape:

```ts
type AgentFn<Input> = (
  providers: ProviderRegistry,
  input: Input
) => Promise<AgentResult>;
```

`AgentResult` (see `src/domain/agent.ts`):

```ts
type AgentResult = {
  agent: AgentName;
  opportunityCandidateId: string;
  summary: string;          // one sentence, human-readable
  findings: Record<string, unknown>;   // structured, agent-specific
  evidence: Evidence[];     // every claim above must trace to at least one of these
  risk?: Risk;
  confidence: number;       // 0-100, agent's confidence in its own findings
};
```

Rules every agent follows:
- Never return a number that didn't come from a provider call or a documented calculation.
- Attach `Evidence` for every specific claim (a demand number, a competitor count, a price).
- If a provider returns "not available," the agent says `DATA NOT AVAILABLE` in `findings` and
  lowers `confidence` — it does not fill the gap with a plausible-sounding guess.
- Agents don't call other agents. Only the Master Agent orchestrates.

## The 10 Phase 1 agents

Chosen because together they can fully answer the one milestone workflow (demand → competition →
customer problems → reviews → improvement → sourcing → economics → advertising risk → regulatory
risk → capital fit). The remaining agents from the original 37-agent list are real future work, not
abandoned — see `ROADMAP.md`.

| Agent | Question it answers | Provider(s) it calls |
|---|---|---|
| `DemandAgent` | Is there real, evidenced demand? | MarketplaceProvider, TrendProvider, SearchProvider |
| `CompetitionAgent` | How saturated is it, who dominates? | MarketplaceProvider |
| `ReviewIntelligenceAgent` | What do existing buyers complain about? | MarketplaceProvider (reviews) |
| `CustomerProblemAgent` | What unmet need is behind the complaints? | SocialProvider, MarketplaceProvider |
| `ProductImprovementAgent` | How would a beginner differentiate? | Derived from Review + Problem findings |
| `SupplierAgent` | Can this beginner actually source it? | SupplierProvider |
| `FinancialAgent` | What does this really cost, what's the margin? | SupplierProvider, MarketplaceProvider (fees), ShippingProvider, TariffProvider |
| `AdvertisingEconomicsAgent` | How paid-traffic-dependent is this? | MarketplaceProvider (ad estimates) |
| `RegulatoryRiskAgent` | Any regulatory complexity a beginner should avoid? | RegulatoryProvider |
| `CapitalProtectionAgent` | Does this fit the user's actual budget and risk tolerance? | Derived from FinancialAgent + user budget |

## Master Agent orchestration (not a flat fan-out)

```
User request
   -> request-parser.ts            (free text -> ResearchRequest)
   -> master-agent.ts: buildResearchPlan(request)
        - selects candidate products from the mock catalog (Phase 1) or a discovery
          step (Phase 2+)
        - decides which of the 10 agents run per candidate (all 10, in Phase 1)
   -> runResearchPlan(plan)
        - Promise.all() the 10 agents per candidate, in parallel
   -> evidence-engine.ts: collect(allAgentResults)
   -> contradiction-engine.ts: check(allAgentResults)
        - e.g. DemandAgent="high" + FinancialAgent="poor margin" +
          AdvertisingEconomicsAgent="high CAC" + user capital=$2,000
          -> contradiction finding, feeds into decision-engine as an override signal,
             not just a lower average
   -> financial-engine.ts: computeFinancials(candidate, findings)
   -> scoring-engine.ts: score(candidate, findings)        (fully transparent breakdown)
   -> decision-engine.ts: decide(score, contradictions, financials, userBudget)
   -> top N opportunities returned, each with full evidence trail
```

This is deliberately **not** "call 37 agents and average their opinions." The contradiction check
runs before scoring and can force a `REJECT` that a pure weighted average would have hidden — this
is the reasoning behavior called out explicitly in the spec.

## Adding a new agent later

1. Add the provider interface method it needs to `domain/provider.ts` (if not already there).
2. Add a mock implementation in `providers/mock/`.
3. Write the agent as a pure function in `agents/`, following the contract above.
4. Register it in `master-agent.ts`'s `buildResearchPlan`.
5. If it introduces a new kind of evidence or score component, extend `scoring-engine.ts`'s weight
   table (see `SCORING.md`) — never hard-code a new number into the total without a named weight.

## User Fit is not an agent

`user-fit-engine.ts` deliberately is NOT an 11th agent. It doesn't call any provider and doesn't
add new evidence — it reads the outputs the 10 agents already produced (regulatory risk score,
advertising dependency, MOQ from supplier evidence, competition findings) plus the user's stated
profile, and computes a separate User Fit dimension. See `SCORING.md` "User Fit" for the formulas.
This keeps the agent contract clean (agents investigate the PRODUCT; User Fit is about the USER)
rather than scattering experience-level logic across 10 different agent files.
