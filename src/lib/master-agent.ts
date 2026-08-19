import { randomUUID } from "crypto";
import { providers } from "@/providers/registry";
import { CANDIDATE_CATALOG } from "@/providers/mock/seed-data";
import { INDEPENDENT_AGENTS, DEPENDENT_AGENTS } from "@/agents";
import { AgentInput, AgentResult, AgentName } from "@/domain/agent";
import { ResearchRequest, ResearchRun, Opportunity, CandidateProduct } from "@/domain/opportunity";
import { collectEvidence } from "./evidence-engine";
import { checkContradictions } from "./contradiction-engine";
import { computeScore } from "./scoring-engine";
import { decide } from "./decision-engine";
import { narrateResults } from "./anthropic";
import { FinancialOutputs } from "@/domain/financial";
import { saveRun, loadRun, loadAllRuns, loadLatestRun } from "./run-store";
import { buildUserProfile, computeUserFit, extractComplexitySignals } from "./user-fit-engine";

const MARKETPLACE_BY_CATEGORY: Record<string, string> = {
  Kitchen: "Amazon (established buyer intent for kitchen tools)",
  "Home Office": "Amazon or Walmart — high existing competition on both",
  "Pet Electronics": "Amazon, pending regulatory confirmation",
  Outdoor: "Amazon — but organic-heavy strategy needed given ad dependency",
  "Home Organization": "Amazon or Etsy — niche fits Etsy's audience well",
  "Baby Products": "Amazon, pending regulatory confirmation (CPSC/ASTM)",
};

function recommendMarketplace(category: string, experienceLevel: ResearchRequest["experienceLevel"]): string {
  const base = MARKETPLACE_BY_CATEGORY[category] ?? "Amazon (default US marketplace for Phase 1)";
  if (experienceLevel === "beginner") {
    return `${base} — start single-channel; avoid multi-marketplace complexity until the first test validates`;
  }
  if (experienceLevel === "advanced") {
    return `${base} — consider a second channel (Walmart/TikTok Shop) in parallel given existing operational capacity`;
  }
  return base;
}

// Builds the Research Plan: which candidates to investigate for this request.
// Phase 1 draws from the seeded demo catalog. Phase 2+ would add a real Opportunity
// Discovery step here instead of (or in addition to) the fixed catalog.
function buildResearchPlan(request: ResearchRequest): CandidateProduct[] {
  // Take a deterministic spread across the catalog so the demo consistently produces a mix
  // of GO/TEST/INVESTIGATE/WAIT/REJECT outcomes rather than N nearly-identical results.
  return CANDIDATE_CATALOG.slice(0, Math.max(request.requestedCount, 5));
}

async function runAgentsForCandidate(
  candidate: CandidateProduct,
  request: ResearchRequest
): Promise<AgentResult[]> {
  const baseInput: AgentInput = { candidate, request };

  // Independent agents run fully in parallel.
  const independentEntries = Object.entries(INDEPENDENT_AGENTS);
  const independentResults = await Promise.all(
    independentEntries.map(([, fn]) => fn(providers, baseInput))
  );

  const priorFindings: Partial<Record<AgentName, AgentResult>> = {};
  for (const r of independentResults) priorFindings[r.agent] = r;

  // Dependent agents run after, with access to the independent agents' findings.
  const dependentEntries = Object.entries(DEPENDENT_AGENTS);
  const dependentResults = await Promise.all(
    dependentEntries.map(([, fn]) => fn(providers, { ...baseInput, priorFindings }))
  );

  return [...independentResults, ...dependentResults];
}

async function buildOpportunity(
  runId: string,
  candidate: CandidateProduct,
  request: ResearchRequest
): Promise<Opportunity> {
  const agentResults = await runAgentsForCandidate(candidate, request);
  const evidenceSummary = collectEvidence(agentResults);
  const contradictions = checkContradictions(agentResults, request);
  const score = computeScore(agentResults);

  const financialAgent = agentResults.find((r) => r.agent === "FinancialAgent");
  const financials = (financialAgent?.findings ?? {}) as unknown as FinancialOutputs;

  // User Fit: computed from the SAME already-run agent findings/evidence, plus the
  // user's stated profile — no new provider calls. Kept as its own dimension rather
  // than folded into the score (see docs/SCORING.md "Hard Gates vs Scored Factors").
  const userProfile = buildUserProfile(request);
  const complexitySignals = extractComplexitySignals(agentResults, evidenceSummary.all);
  const userFit = computeUserFit(userProfile, complexitySignals, financials);

  const { decision, narrative, actionPlan } = decide(
    score,
    contradictions,
    financials,
    request.capital,
    candidate.name,
    userFit
  );

  const beginnerDifficulty =
    (agentResults.find((r) => r.agent === "CompetitionAgent")?.risk?.level as Opportunity["beginnerDifficulty"]) ??
    "MEDIUM";

  return {
    id: `opp-${candidate.id}-${runId.slice(0, 8)}`,
    runId,
    candidate,
    targetMarket: "US",
    marketplaceRecommendation: recommendMarketplace(candidate.category, request.experienceLevel),
    agentResults,
    evidence: evidenceSummary.all,
    contradictions,
    financials,
    score,
    decision,
    decisionNarrative: narrative,
    actionPlan,
    beginnerDifficulty,
    capitalRequired: financials.cashRequiredForTest ?? 0,
    userFit,
    createdAt: new Date().toISOString(),
  };
}

export async function runMasterAgent(request: ResearchRequest): Promise<ResearchRun> {
  const runId = randomUUID();
  const candidates = buildResearchPlan(request);

  const opportunities = await Promise.all(
    candidates.map((c) => buildOpportunity(runId, c, request))
  );

  // Rank: GO/TEST/INVESTIGATE first (by score desc), REJECT/WAIT last — a beginner asking
  // "find me opportunities" wants actionable ones surfaced first, but rejects/waits are kept
  // in the result set (and shown) rather than silently dropped, since the Kill List needs them.
  const rank: Record<Opportunity["decision"], number> = { GO: 0, TEST: 1, INVESTIGATE: 2, WAIT: 3, REJECT: 4 };
  opportunities.sort((a, b) => rank[a.decision] - rank[b.decision] || b.score.total - a.score.total);

  const top = opportunities.slice(0, request.requestedCount);
  const narrative = await narrateResults(request, top);

  const run: ResearchRun = {
    id: runId,
    request,
    opportunities: top,
    createdAt: new Date().toISOString(),
    narrative,
  };

  await saveRun(run);
  return run;
}

export async function getRunFromCache(runId: string): Promise<ResearchRun | undefined> {
  return loadRun(runId);
}

export async function getOpportunityFromCache(opportunityId: string): Promise<Opportunity | undefined> {
  for (const run of await loadAllRuns()) {
    const found = run.opportunities.find((o) => o.id === opportunityId);
    if (found) return found;
  }
  return undefined;
}

export async function getAllCachedOpportunities(): Promise<Opportunity[]> {
  const runs = await loadAllRuns();
  return runs.flatMap((r) => r.opportunities);
}

export async function getKillListFromCache(): Promise<Opportunity[]> {
  const all = await getAllCachedOpportunities();
  return all.filter((o) => o.decision === "REJECT");
}

export async function getLatestRunFromCache(): Promise<ResearchRun | undefined> {
  return loadLatestRun();
}
