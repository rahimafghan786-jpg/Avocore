# Avocore — Scoring & Decision (Phase 1)

## Two separate things

Avocore never collapses "how good is this opportunity" and "how sure are we" into one number.

1. **Opportunity Score** (0-100) — how good the opportunity looks, *given the evidence*.
2. **Confidence scores** (0-100 each) — how much to trust the evidence behind it:
   `dataConfidence`, `profitConfidence`, `supplierConfidence`, `regulatoryConfidence`.

Both are always shown together. A high opportunity score with low confidence is not a "good"
result — the UI treats it as `INVESTIGATE`, not `GO`.

## Opportunity Score — transparent weights

Default weights (all configurable in `lib/scoring-engine.ts`, shown in full in the UI, never
hidden):

| Component | Weight |
|---|---|
| Demand Quality | 20% |
| Demand Growth | 10% |
| Competition | 15% |
| Margin Potential | 15% |
| Manufacturing/Sourcing Feasibility | 10% |
| Supply Availability | 10% |
| Advertising Dependency | 5% |
| Regulatory Risk | 5% |
| Capital Efficiency | 5% |
| Differentiation Potential | 5% |

Each component is scored 0-100 by the relevant agent's findings, and the final weighted sum is
shown alongside every individual component score — never just the total.

## Contradiction Check — the important part

`contradiction-engine.ts` runs **before** the decision is made, over the raw agent findings, looking
for known patterns that a weighted average would wash out. Phase 1 ships with these rules:

- **Demand-vs-Economics trap**: high demand + poor margin + high/extreme advertising dependency +
  user capital below the estimated break-even inventory + advertising test budget → flags
  "unsuitable for beginner capital," regardless of score.
- **Saturation trap**: strong demand + very high competition concentration (few dominant brands
  owning most reviews) → flags "high dominant-brand risk," downgrades differentiation potential.
- **Regulatory trap**: any `RegulatoryRiskAgent` finding of `STOP AND VERIFY` → hard-blocks `GO`,
  regardless of score; max allowed decision is `INVESTIGATE`.
- **Confidence trap**: if `supplierConfidence` or `profitConfidence` < 50, max allowed decision is
  `TEST` (small quantity only), never `GO`.

Each contradiction produces a plain-English note, e.g.:

> High demand exists, but the economics make this unsuitable for a beginner with $2,000: estimated
> margin is 11% after fees and freight, and category advertising is EXTREME-dependency. REJECT.

This note is stored (`contradiction_findings` table) and shown directly under the decision — the
user always sees the reasoning, not just a badge.

## Decision Engine

`decision-engine.ts` takes `(score, contradictions, financials, userBudget)` and applies rules in
this order (first match wins):

1. Any hard-block contradiction (regulatory `STOP AND VERIFY`) → `REJECT` or `INVESTIGATE`
   (regulatory-only unknowns get `INVESTIGATE`; confirmed high regulatory risk gets `REJECT`).
2. Capital required > user's stated available capital → `WAIT` (with the capital gap shown).
3. Demand-vs-Economics or Saturation contradiction present → `REJECT`, with the note above.
4. Confidence trap present → `TEST` at the minimum viable quantity, capped budget.
5. Otherwise, score-based:
   - 80-100 → `GO`
   - 60-79 → `TEST`
   - 40-59 → `INVESTIGATE`
   - < 40 → `REJECT`

For `TEST`, the engine always fills in: test quantity, budget, target price, target margin, and
explicit success/failure criteria — never a bare "test it" recommendation.

## Hard Gates vs. Scored Factors (Phase 1.5)

Avocore deliberately has TWO separate mechanisms for stopping a bad recommendation, and they
are not interchangeable:

**Scored factors** (`scoring-engine.ts`) are the 10 weighted components that sum to
`OpportunityScore.total`. They answer "how good does this look, on balance?" A weak factor here
just pulls the average down — it can be outweighed by strong factors elsewhere. This is fine for
factors where "somewhat weak" is a legitimate, gradable state (e.g. differentiation potential).

**Hard gates** are binary: contradiction findings with `forcesDecision` set, and the User Fit gate
below. A hard gate cannot be outvoted by a good score. This exists specifically because some
failure modes are not "somewhat bad" — a -44% contribution margin doesn't become acceptable
because demand is high, no matter how the weights are tuned. See `checkContradictions()` in
`contradiction-engine.ts` for the full rule list (`DEMAND_VS_ECONOMICS`, `LANDED_COST_TRAP`,
`SATURATION`, `WEAK_DEMAND` at 3+ signals, `REGULATORY` at risk≥75) and `decide()` in
`decision-engine.ts` for how the User Fit gate (below) applies the same mechanism.

**The architecture makes it structurally impossible for a high demand score to override a
CRITICAL contradiction** — `decide()` checks `forcesDecision` before it ever looks at
`score.total`. A REJECT-forcing contradiction short-circuits the score-based decision entirely.

## Contradiction Severity

Every `ContradictionFinding` now carries:

- `type` — machine-readable slug (`SATURATION`, `WEAK_DEMAND`, `LANDED_COST_TRAP`, etc.)
- `severity` — `CRITICAL` / `HIGH` / `MEDIUM` / `LOW`
- `evidenceSummary` — the specific findings that triggered it (for the UI/memo, not re-derived)
- `affectedMetrics` — which fields in `financials`/`findings` are implicated
- `recommendedAction` — what a human should actually do about it

Severity mapping (see `contradiction-engine.ts` for the exact conditions):

| Rule | Severity | Mechanism |
|---|---|---|
| `DEMAND_VS_ECONOMICS` | CRITICAL | Forces REJECT |
| `LANDED_COST_TRAP` | CRITICAL | Forces REJECT |
| `SATURATION` | CRITICAL | Forces REJECT |
| `WEAK_DEMAND` (3+ signals) | CRITICAL | Forces REJECT |
| `WEAK_DEMAND` (2 signals) | HIGH | Caps at INVESTIGATE |
| `WEAK_DEMAND` (1 signal) | MEDIUM | Caps at TEST |
| `REGULATORY` (risk≥75) | CRITICAL | Forces REJECT |
| `REGULATORY` (risk<75) | HIGH | Caps at INVESTIGATE |
| `LOW_CONFIDENCE` | MEDIUM | Caps at TEST |

## Weak-Demand Protection

Deliberately multi-signal, not a single threshold — "low competition" and "low demand" are
different findings and must not be conflated (an uncrowded category can mean an underserved
niche just as easily as it can mean nobody wants the product). The rule counts how many of these
four independent signals are present:

1. `demandQualityScore < 40`
2. `trendDirection === "declining"`
3. `demandGrowthScore < 40`
4. `avgMonthlySales < 150`

Signal count → severity: 3-4 signals = CRITICAL (forces REJECT), 2 = HIGH (caps INVESTIGATE),
1 = MEDIUM (caps TEST), 0 = rule doesn't fire. **Documented assumption**: these thresholds are a
Phase 1 mock-data-appropriate starting point, not empirically tuned. The spec's longer-term intent
(thresholds varying by price/margin/capital/marketplace/category) is Phase 2+ scope — flagged in
`ROADMAP.md`.

## User Fit (separate from Opportunity Score)

See `domain/user-fit.ts` and `lib/user-fit-engine.ts` for the full implementation. Opportunity
Score answers "is this a good product, objectively?" User Fit answers "is this a good product FOR
THIS USER?" — capital, experience level, and stated risk tolerance change User Fit; they do NOT
change the underlying Opportunity Score, which stays a description of the product/market, not the
buyer.

**Profile tolerances** (`BASE_TOLERANCES` in `user-fit-engine.ts`) are set per experience level
(beginner/intermediate/advanced) across regulatory, complexity, advertising, and competition
tolerance, plus a safe capital allocation percentage (35%/50%/65%). Risk tolerance (low/moderate/
high) nudges these by up to ±15 points and ±10 allocation percentage points — it does not override
experience level.

**Four sub-scores**, each 0-100:
- `profileFit` — is the product's inherent complexity appropriate for this experience level
  (regulatory 40% + complexity 35% + advertising 25%)
- `capitalFit` — does a full test fit within a SAFE allocation of capital, not just "can they
  technically afford it"
- `complexityFit` — MOQ + supplier verification vs. tolerance
- `riskFit` — competition + regulatory + advertising vs. stated risk tolerance

`userFitScore = profileFit×0.35 + capitalFit×0.30 + complexityFit×0.15 + riskFit×0.20`

**Gate**: `userFitScore < 35` caps the decision at INVESTIGATE regardless of the raw opportunity
score — same hard-gate mechanism as a forced-REJECT contradiction, applied in `decide()`.

**Important non-goal**: a low-complexity product produces the SAME high User Fit across every
experience level. Fit only diverges when the product's actual complexity/risk exceeds one
profile's tolerance but not another's — this was a deliberate constraint to avoid "subtract
arbitrary points because beginner," per the original spec.

## Capital Protection

`user-fit-engine.ts`'s `computeUserFit()` never recommends a test larger than
`profile.safeCapitalAllocationPercent × capital`, even when the "full" default test (previously a
flat 100 units) would cost more. `decision-engine.ts` uses this recommended size —
`recommendedTestSize`/`recommendedTestBudget`/`recommendedReserve`/`capitalAtRiskPercent` — to
build the action plan, replacing the old flat 100/200-unit assumption entirely.

**WAIT gate**: only triggers when even a `MIN_VIABLE_TEST_UNITS` (10 units) test doesn't fit
available capital — not when the old flat 100-unit default doesn't fit. This was a real bug found
during Phase 1.5 validation: a $500 beginner with a genuinely affordable 13-unit test option was
getting blanket WAIT because the gate checked against a 100-unit assumption. Fixed and regression-
tested (see `docs/ROADMAP.md` changelog).

