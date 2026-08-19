import { Decision, ContradictionFinding, OpportunityScore } from "@/domain/opportunity";
import { FinancialOutputs } from "@/domain/financial";
import { ActionPlan } from "@/domain/agent";
import { UserFitResult } from "@/domain/user-fit";

const DECISION_RANK: Record<Decision, number> = {
  REJECT: 0,
  WAIT: 1,
  INVESTIGATE: 2,
  TEST: 3,
  GO: 4,
};

// Below this User Fit score, the product's complexity/risk genuinely exceeds what
// this user profile should take on — regardless of how good the raw opportunity
// score is. This is a HARD GATE, same category as a contradiction forcing REJECT,
// not an additional scored factor. See docs/SCORING.md "Hard Gates vs Scored
// Factors" — the whole point of a gate is that a high score cannot buy its way past
// it. 35 was chosen so a single moderately-exceeded tolerance (e.g. one of
// regulatory/complexity/advertising meaningfully over the profile's limit) triggers
// it, without over-triggering on a single mildly-elevated metric.
const USER_FIT_CAP_THRESHOLD = 35;

// The smallest test size worth running at all — below this, sample size is too
// small to learn anything meaningful (a 2-unit "test" isn't a test). WAIT should
// only trigger when even a MINIMUM viable test doesn't fit, not when the full
// default-sized test doesn't fit — those are very different situations, and
// conflating them is what caused low-capital users to get blanket WAIT even when
// a smaller, still-useful test was clearly affordable.
const MIN_VIABLE_TEST_UNITS = 10;

function capAt(decision: Decision, cap: Decision): Decision {
  return DECISION_RANK[decision] > DECISION_RANK[cap] ? cap : decision;
}

export interface DecisionResult {
  decision: Decision;
  narrative: string;
  actionPlan: ActionPlan;
}

// Rules apply in order — first hard-block wins. This is deliberately NOT "average the
// scores": a contradiction finding (or a User Fit gate) can force/cap a decision even
// when the raw score looks decent.
export function decide(
  score: OpportunityScore,
  contradictions: ContradictionFinding[],
  financials: FinancialOutputs,
  userCapital: number,
  productName: string,
  userFit: UserFitResult
): DecisionResult {
  const notes: string[] = [];
  let decision: Decision;

  const forced = contradictions.find((c) => c.forcesDecision)?.forcesDecision;
  // Deduplicated — the bug found in live testing: multiple contradictions can share
  // the same capsDecision value (e.g. both weak-demand and regulatory capping at
  // INVESTIGATE), and without deduplication the loop below would re-push the same
  // narratives once per duplicate cap entry, producing visibly repeated text.
  const capped = [...new Set(contradictions.map((c) => c.capsDecision).filter(Boolean))] as Decision[];

  const minViableTestCost = financials.landedCostPerUnit * MIN_VIABLE_TEST_UNITS;

  if (forced) {
    decision = forced;
    notes.push(...contradictions.filter((c) => c.forcesDecision === forced).map((c) => c.narrative));
  } else if (minViableTestCost > userCapital) {
    // Even the smallest useful test doesn't fit — this is genuine WAIT territory,
    // not just "the default 100-unit test is large relative to capital."
    decision = "WAIT";
    notes.push(
      `Even a minimum viable test of ${productName} (${MIN_VIABLE_TEST_UNITS} units, ~$${minViableTestCost.toFixed(
        2
      )}) exceeds the stated available capital of $${userCapital.toFixed(
        2
      )}. WAIT until more capital is available.`
    );
  } else {
    if (score.total >= 80) decision = "GO";
    else if (score.total >= 60) decision = "TEST";
    else if (score.total >= 40) decision = "INVESTIGATE";
    else decision = "REJECT";
    notes.push(
      `Opportunity score is ${score.total}/100 (data confidence ${score.dataConfidence}/100, profit confidence ${score.profitConfidence}/100, supplier confidence ${score.supplierConfidence}/100).`
    );
  }

  for (const cap of capped) {
    decision = capAt(decision, cap);
    // Always surface the reasoning for a fired cap — even when the decision was
    // already at or below that cap level, so it doesn't visibly change. A real
    // regulatory/confidence finding that fired is meaningful context regardless of
    // whether it happened to move the final tier; silently dropping it from the
    // narrative just because the score already landed in the same place hides real
    // evidence from the user. This was a real Phase 1 gap exposed by Phase 2A's
    // more conservative CATEGORY_MATCH severity, which caps at INVESTIGATE more
    // often than the old always-STOP-AND-VERIFY mock did.
    notes.push(...contradictions.filter((c) => c.capsDecision === cap).map((c) => c.narrative));
  }

  // User Fit gate — applied after contradictions, same hard-cap mechanism. A product
  // that's a poor fit for this specific user profile cannot be a GO/TEST just because
  // the raw score and contradiction checks passed; it caps at INVESTIGATE.
  if (userFit.userFitScore < USER_FIT_CAP_THRESHOLD) {
    const before = decision;
    decision = capAt(decision, "INVESTIGATE");
    if (decision !== before) {
      notes.push(
        `User Fit score is ${userFit.userFitScore}/100 for this profile — below the threshold for a full TEST/GO commitment. ${userFit.notes.join(" ")}`
      );
    }
  }

  const actionPlan = buildActionPlan(decision, financials, productName, userFit);
  const narrative = notes.join(" ");

  return { decision, narrative, actionPlan };
}

function buildActionPlan(
  decision: Decision,
  financials: FinancialOutputs,
  productName: string,
  userFit: UserFitResult
): ActionPlan {
  switch (decision) {
    case "GO":
    case "TEST": {
      // Capital protection: use the User Fit engine's recommended (safe-allocation)
      // test size, not a flat 100/200 units. This is what stops the system from
      // encouraging someone to spend $1,900 of a $2,000 budget just because it
      // technically fits.
      const testQuantity = userFit.recommendedTestSize;
      const testBudget = userFit.recommendedTestBudget;
      return {
        action: decision,
        testQuantity,
        testBudget,
        targetPrice: undefined,
        successCriteria: [
          `Sell through at least 60% of the test batch within 60 days`,
          `Maintain contribution margin within 3 points of the ${financials.contributionMarginPercent.toFixed(
            1
          )}% estimate`,
          `Return rate stays under 8%`,
        ],
        failureCriteria: [
          `Sell-through under 30% after 60 days`,
          `Actual margin more than 10 points below estimate`,
          `Return rate over 15%`,
        ],
        nextSteps: [
          `Request samples from the top 2 supplier candidates before committing to the full test quantity`,
          `Confirm marketplace fee and tariff estimates before finalizing the sell price for ${productName}`,
          `Set up the listing with the differentiation angle identified by the Product Improvement Agent`,
          `Capital plan: $${testBudget.toFixed(2)} test (${userFit.capitalAtRiskPercent.toFixed(
            1
          )}% of available capital), $${userFit.recommendedReserve.toFixed(2)} held in reserve`,
        ],
      };
    }
    case "INVESTIGATE":
      return {
        action: "INVESTIGATE",
        nextSteps: [
          `Get direct supplier quotes to replace the current preliminary pricing`,
          `Pull a larger review sample to confirm the complaint pattern before committing capital`,
          `Re-run this analysis once supplier and regulatory confidence improve`,
        ],
      };
    case "WAIT":
      return {
        action: "WAIT",
        nextSteps: [
          `Revisit once available capital covers the minimum viable test cost ($${financials.cashRequiredForTest.toFixed(
            2
          )})`,
          `Consider a smaller initial test quantity to lower the capital requirement`,
        ],
      };
    case "REJECT":
    default:
      return {
        action: "REJECT",
        nextSteps: [
          `Add to the Kill List with the reasons shown above`,
          `Do not revisit without new evidence that changes the underlying economics or competitive picture`,
        ],
      };
  }
}
