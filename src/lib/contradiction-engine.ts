import { AgentResult, AgentName } from "@/domain/agent";
import { ContradictionFinding, ContradictionSeverity, ResearchRequest } from "@/domain/opportunity";
import { randomUUID } from "crypto";

type FindingsByAgent = Partial<Record<AgentName, AgentResult>>;

function indexByAgent(results: AgentResult[]): FindingsByAgent {
  const map: FindingsByAgent = {};
  for (const r of results) map[r.agent] = r;
  return map;
}

function makeFinding(params: {
  type: string;
  severity: ContradictionSeverity;
  narrative: string;
  evidenceSummary: string;
  affectedMetrics: string[];
  recommendedAction: string;
  forcesDecision?: ContradictionFinding["forcesDecision"];
  capsDecision?: ContradictionFinding["capsDecision"];
}): ContradictionFinding {
  return {
    id: randomUUID(),
    type: params.type,
    patternMatched: params.type.toLowerCase(),
    severity: params.severity,
    narrative: params.narrative,
    evidenceSummary: params.evidenceSummary,
    affectedMetrics: params.affectedMetrics,
    recommendedAction: params.recommendedAction,
    forcesDecision: params.forcesDecision,
    capsDecision: params.capsDecision,
  };
}

// Rule-based contradiction detection. This runs BEFORE scoring specifically so a real
// conflict between agents (e.g. high demand + poor economics) can force a decision that a
// pure weighted average would hide. See docs/SCORING.md "Hard Gates vs Scored Factors"
// for why these exist as hard rules rather than additional score weights: a rule here
// can force REJECT regardless of how good the raw score looks, which no amount of
// weight-tuning on the scoring engine alone can guarantee.
export function checkContradictions(
  results: AgentResult[],
  request: ResearchRequest
): ContradictionFinding[] {
  const byAgent = indexByAgent(results);
  const findings: ContradictionFinding[] = [];

  const demand = byAgent.DemandAgent;
  const financial = byAgent.FinancialAgent;
  const advertising = byAgent.AdvertisingEconomicsAgent;
  const competition = byAgent.CompetitionAgent;
  const regulatory = byAgent.RegulatoryRiskAgent;
  const capital = byAgent.CapitalProtectionAgent;

  // 1. Demand-vs-Economics trap (ad-driven margin collapse)
  if (demand && financial && advertising) {
    const highDemand = (demand.findings.demandQualityScore as number) >= 65;
    const poorMargin = (financial.findings.contributionMarginPercent as number) < 15;
    const highAdDependency =
      advertising.findings.dependencyLevel === "HIGH" || advertising.findings.dependencyLevel === "EXTREME";
    const tightOnCapital = capital ? capital.findings.fitsCapital === false || (capital.findings.capitalEfficiencyScore as number) <= 40 : false;

    if (highDemand && poorMargin && highAdDependency) {
      findings.push(
        makeFinding({
          type: "DEMAND_VS_ECONOMICS",
          severity: "CRITICAL",
          narrative: `High demand exists, but the economics make this unsuitable for a beginner with $${request.capital.toLocaleString()}: estimated contribution margin is ${(
            financial.findings.contributionMarginPercent as number
          ).toFixed(1)}%, and this category is ${advertising.findings.dependencyLevel}-dependency on paid advertising. ${
            tightOnCapital ? "The test batch would also use a large share of the available capital." : ""
          } REJECT.`,
          evidenceSummary: `demandQualityScore=${demand.findings.demandQualityScore}, contributionMarginPercent=${financial.findings.contributionMarginPercent}, adDependency=${advertising.findings.dependencyLevel}`,
          affectedMetrics: ["contributionMarginPercent", "dependencyLevel", "demandQualityScore"],
          recommendedAction: "Reject — high paid-traffic dependency combined with a sub-15% margin means ad spend alone can erase profit. Do not proceed without a fundamentally different cost structure.",
          forcesDecision: "REJECT",
        })
      );
    }
  }

  // 2. Landed-cost trap: bad UNIT ECONOMICS independent of advertising. Deliberately
  // distinct from rule 1 — this fires when margin is poor for reasons OTHER than ad
  // spend (high supplier cost, freight, duties), proving bad economics alone can
  // override high demand without needing an advertising problem too.
  if (demand && financial && advertising) {
    const highDemand = (demand.findings.demandQualityScore as number) >= 65;
    const poorMargin = (financial.findings.contributionMarginPercent as number) < 15;
    const lowOrModerateAdDependency =
      advertising.findings.dependencyLevel === "LOW" || advertising.findings.dependencyLevel === "MEDIUM";
    const landedCostHeavy = (financial.findings.grossMarginPercent as number) < 45;

    if (highDemand && poorMargin && lowOrModerateAdDependency && landedCostHeavy) {
      findings.push(
        makeFinding({
          type: "LANDED_COST_TRAP",
          severity: "CRITICAL",
          narrative: `Demand is strong and advertising dependency is only ${advertising.findings.dependencyLevel}, but the landed cost structure alone makes this unprofitable: gross margin is only ${(
            financial.findings.grossMarginPercent as number
          ).toFixed(1)}% before fees, and contribution margin is ${(financial.findings.contributionMarginPercent as number).toFixed(1)}% after them. This is a supplier cost / freight / duty problem, not an advertising problem — more ad-efficient traffic will not fix it.`,
          evidenceSummary: `grossMarginPercent=${financial.findings.grossMarginPercent}, contributionMarginPercent=${financial.findings.contributionMarginPercent}, adDependency=${advertising.findings.dependencyLevel} (not the cause)`,
          affectedMetrics: ["grossMarginPercent", "landedCostPerUnit", "contributionMarginPercent"],
          recommendedAction: "Reject unless landed cost can be renegotiated — lower supplier unit cost, cheaper freight, or a lower-duty sourcing country. Do not proceed on the current cost structure.",
          forcesDecision: "REJECT",
        })
      );
    }
  }

  // 3. Saturation trap
  if (demand && competition) {
    const highDemand = (demand.findings.demandQualityScore as number) >= 65;
    const dominantBrandRisk = competition.findings.dominantBrandRisk === true;
    const highCompetitionCount = (competition.findings.avgSellerCount as number) >= 80;

    if (highDemand && dominantBrandRisk && highCompetitionCount) {
      findings.push(
        makeFinding({
          type: "SATURATION",
          severity: "CRITICAL",
          narrative: `Demand looks strong, but the category is saturated: ~${
            competition.findings.avgSellerCount
          } observed sellers and a dominant brand holding ~${(
            (competition.findings.dominantBrandShare as number) * 100
          ).toFixed(0)}% of reviews. A beginner would be competing directly against an entrenched leader with no differentiation edge yet identified.`,
          evidenceSummary: `avgSellerCount=${competition.findings.avgSellerCount}, dominantBrandShare=${competition.findings.dominantBrandShare}`,
          affectedMetrics: ["avgSellerCount", "dominantBrandShare"],
          recommendedAction: "Reject for a beginner. An experienced seller with a clear differentiation angle and larger ad budget may still evaluate this, but the current evidence shows no such angle yet.",
          forcesDecision: "REJECT",
        })
      );
    }
  }

  // 4. Weak/declining demand — deliberately multi-signal, not a single threshold.
  // "Low competition" and "low demand" are NOT the same finding and must not be
  // conflated: an uncrowded category can mean nobody wants the product just as
  // easily as it can mean an underserved niche. This rule counts how many
  // independent weak-demand signals are present and scales severity accordingly,
  // rather than rejecting on any one number in isolation.
  if (demand) {
    const demandQualityScore = demand.findings.demandQualityScore as number;
    const demandGrowthScore = demand.findings.demandGrowthScore as number;
    const trendDirection = demand.findings.trendDirection as string;
    const avgMonthlySales = demand.findings.avgMonthlySales as number;

    let weakSignals = 0;
    const signalNotes: string[] = [];
    if (demandQualityScore < 40) { weakSignals++; signalNotes.push(`low demand quality score (${demandQualityScore}/100)`); }
    if (trendDirection === "declining") { weakSignals++; signalNotes.push("declining search trend"); }
    if (demandGrowthScore < 40) { weakSignals++; signalNotes.push(`weak demand growth score (${demandGrowthScore}/100)`); }
    if (avgMonthlySales < 150) { weakSignals++; signalNotes.push(`low absolute sales velocity (~${avgMonthlySales}/month)`); }

    if (weakSignals >= 1) {
      const severity: ContradictionSeverity = weakSignals >= 3 ? "CRITICAL" : weakSignals === 2 ? "HIGH" : "MEDIUM";
      const forces = weakSignals >= 3 ? "REJECT" : undefined;
      const caps = weakSignals === 2 ? "INVESTIGATE" : weakSignals === 1 ? "TEST" : undefined;
      findings.push(
        makeFinding({
          type: "WEAK_DEMAND",
          severity,
          narrative:
            weakSignals >= 3
              ? `Demand is structurally too weak to justify entering this market: ${signalNotes.join(", ")}. This is separate from competition level — low competition here likely reflects low interest, not an underserved opportunity.`
              : `Demand shows ${weakSignals} weak signal(s): ${signalNotes.join(", ")}. Worth testing cautiously with strong evidence review before committing further capital.`,
          evidenceSummary: `demandQualityScore=${demandQualityScore}, demandGrowthScore=${demandGrowthScore}, trendDirection=${trendDirection}, avgMonthlySales=${avgMonthlySales}, weakSignalCount=${weakSignals}`,
          affectedMetrics: ["demandQualityScore", "demandGrowthScore", "trendDirection", "avgMonthlySales"],
          recommendedAction:
            weakSignals >= 3
              ? "Reject — do not test without new evidence showing meaningfully stronger demand than what's currently observed."
              : "Proceed only with a small test and explicit demand-validation checkpoints before scaling.",
          forcesDecision: forces,
          capsDecision: caps,
        })
      );
    }
  }

  // 5. Regulatory trap
  if (regulatory?.findings.requiresStopAndVerify) {
    const highRisk = (regulatory.findings.riskScore as number) >= 75;
    findings.push(
      makeFinding({
        type: "REGULATORY",
        severity: highRisk ? "CRITICAL" : "HIGH",
        narrative: `This category (${(regulatory.findings.category as string) ?? "this product category"}) commonly requires ${
          (regulatory.findings.requiredAgencies as string[]).join(" / ") || "regulatory"
        } review. STOP AND VERIFY with a qualified professional before sourcing or listing.`,
        evidenceSummary: `riskScore=${regulatory.findings.riskScore}, requiredAgencies=${(regulatory.findings.requiredAgencies as string[]).join("/")}`,
        affectedMetrics: ["riskScore", "requiredAgencies"],
        recommendedAction: highRisk
          ? "Reject unless a qualified professional confirms compliance is achievable at reasonable cost."
          : "Investigate — consult a qualified professional before sourcing, but this is not automatically disqualifying.",
        forcesDecision: highRisk ? "REJECT" : undefined,
        capsDecision: highRisk ? undefined : "INVESTIGATE",
      })
    );
  }

  // 6. Confidence trap
  const supplier = byAgent.SupplierAgent;
  if (financial && supplier) {
    const lowSupplierConfidence = (supplier.findings.supplierConfidence as number) < 50;
    const lowProfitConfidence = financial.confidence < 50;
    if (lowSupplierConfidence || lowProfitConfidence) {
      findings.push(
        makeFinding({
          type: "LOW_CONFIDENCE",
          severity: "MEDIUM",
          narrative: `${
            lowSupplierConfidence ? "No supplier has been sample-verified yet. " : ""
          }${
            lowProfitConfidence ? "Financial estimates rely on unconfirmed fee/tariff/freight figures. " : ""
          }Confidence is too low for a full commitment — a small test is the most this evidence supports.`,
          evidenceSummary: `supplierConfidence=${supplier.findings.supplierConfidence}, financialConfidence=${financial.confidence}`,
          affectedMetrics: ["supplierConfidence", "financialConfidence"],
          recommendedAction: "Verify supplier samples and confirm fee/tariff/freight figures before scaling past an initial test.",
          capsDecision: "TEST",
        })
      );
    }
  }

  return findings;
}
