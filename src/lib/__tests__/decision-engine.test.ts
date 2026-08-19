// Run with: npx tsx src/lib/__tests__/decision-engine.test.ts
// Regression test for a real bug found in live testing: when multiple
// contradictions cap the decision at the SAME tier (e.g. both weak-demand and
// regulatory capping at INVESTIGATE), the narrative text for each was being
// duplicated — once per repeated cap-value entry in an undeduplicated array.

import { decide } from "../decision-engine";
import type { ContradictionFinding, OpportunityScore } from "../../domain/opportunity";
import type { FinancialOutputs } from "../../domain/financial";
import type { UserFitResult } from "../../domain/user-fit";

let passed = 0;
let failed = 0;
function check(condition: boolean, label: string) {
  if (condition) { passed++; console.log(`PASS: ${label}`); }
  else { failed++; console.log(`FAIL: ${label}`); }
}

const score: OpportunityScore = {
  total: 53,
  components: [],
  dataConfidence: 51,
  profitConfidence: 55,
  supplierConfidence: 45,
  regulatoryConfidence: 40,
};

const financials: FinancialOutputs = {
  landedCostPerUnit: 5,
  totalCostPerUnit: 10,
  contributionMarginPerUnit: 5,
  contributionMarginPercent: 30,
  grossMarginPercent: 50,
  breakEvenUnits: 20,
  breakEvenRevenue: 200,
  cashRequiredForTest: 500,
  roiPercentAtTestQuantity: 50,
  maxAffordableInventoryUnits: 400,
};

const userFit: UserFitResult = {
  userFitScore: 70,
  profileFit: 70,
  capitalFit: 70,
  complexityFit: 70,
  riskFit: 70,
  recommendedTestAllocationPercent: 0.35,
  recommendedTestSize: 50,
  recommendedTestBudget: 250,
  recommendedReserve: 1750,
  capitalAtRiskPercent: 12.5,
  notes: [],
};

// Two DIFFERENT contradictions that both cap at INVESTIGATE — the exact scenario
// from the live bug (weak-demand + regulatory both capping the same tier).
const contradictions: ContradictionFinding[] = [
  {
    id: "c1",
    type: "WEAK_DEMAND",
    severity: "HIGH",
    patternMatched: "weak_demand",
    narrative: "WEAK_DEMAND_NARRATIVE_MARKER",
    evidenceSummary: "",
    affectedMetrics: [],
    recommendedAction: "",
    capsDecision: "INVESTIGATE",
  },
  {
    id: "c2",
    type: "REGULATORY",
    severity: "HIGH",
    patternMatched: "regulatory",
    narrative: "REGULATORY_NARRATIVE_MARKER",
    evidenceSummary: "",
    affectedMetrics: [],
    recommendedAction: "",
    capsDecision: "INVESTIGATE",
  },
];

const result = decide(score, contradictions, financials, 2000, "Test Product", userFit);

console.log("=== Duplicate-narrative regression ===");
const weakDemandCount = (result.narrative.match(/WEAK_DEMAND_NARRATIVE_MARKER/g) ?? []).length;
const regulatoryCount = (result.narrative.match(/REGULATORY_NARRATIVE_MARKER/g) ?? []).length;
check(weakDemandCount === 1, `weak-demand narrative appears exactly once (found ${weakDemandCount})`);
check(regulatoryCount === 1, `regulatory narrative appears exactly once (found ${regulatoryCount})`);
check(result.decision === "INVESTIGATE", "decision correctly capped at INVESTIGATE");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
