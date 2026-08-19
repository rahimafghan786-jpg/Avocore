import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ResearchRun, Opportunity, ContradictionFinding } from "@/domain/opportunity";
import { Evidence, Source } from "@/domain/evidence";
import { createAdminClient, isSupabaseConfigured } from "./supabase/admin";

// ---------------------------------------------------------------------------
// Local file fallback (used only when Supabase env vars aren't set — e.g. local
// dev without a provisioned project). On Vercel this path is never writable
// outside /tmp, so it's a dev convenience only, not a production store.
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), ".avocore-data");
const RUNS_FILE = path.join(DATA_DIR, "runs.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAllRunsFromFile(): ResearchRun[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(RUNS_FILE)) return [];
    const raw = fs.readFileSync(RUNS_FILE, "utf-8");
    if (!raw.trim()) return [];
    return JSON.parse(raw) as ResearchRun[];
  } catch (err) {
    console.error("Failed to read local run store, starting fresh:", err);
    return [];
  }
}

function writeAllRunsToFile(runs: ResearchRun[]) {
  try {
    ensureDataDir();
    fs.writeFileSync(RUNS_FILE, JSON.stringify(runs.slice(-50)), "utf-8");
  } catch (err) {
    console.error("Failed to write local run store:", err);
  }
}

// ---------------------------------------------------------------------------
// Supabase-backed persistence (the real Phase 1.5 store)
// ---------------------------------------------------------------------------

function isMissingColumnError(message: string): boolean {
  return /column .* does not exist/i.test(message);
}

async function saveRunToSupabase(run: ResearchRun): Promise<void> {
  const supabase = createAdminClient();

  const { error: runError } = await supabase.from("research_runs").insert({
    id: run.id,
    user_id: null,
    raw_message: run.request.rawMessage,
    parsed_request: run.request,
    narrative: run.narrative,
    status: "completed",
    created_at: run.createdAt,
  });
  if (runError) throw new Error(`Failed to save research_runs row: ${runError.message}`);

  // Dedupe sources across all opportunities in this run so repeated providers
  // (e.g. "Mock Marketplace Provider") don't create duplicate rows.
  const sourceIdMap = new Map<string, string>(); // app-level source.id -> db uuid
  const sourcesToInsert: { id: string; name: string; url?: string; provider_key: string }[] = [];

  for (const o of run.opportunities) {
    for (const e of o.evidence) {
      if (!sourceIdMap.has(e.source.id)) {
        const dbId = randomUUID();
        sourceIdMap.set(e.source.id, dbId);
        sourcesToInsert.push({
          id: dbId,
          name: e.source.name,
          url: e.source.url,
          provider_key: e.source.providerKey,
        });
      }
    }
  }

  if (sourcesToInsert.length > 0) {
    const { error: sourcesError } = await supabase.from("sources").insert(sourcesToInsert);
    if (sourcesError) throw new Error(`Failed to save sources: ${sourcesError.message}`);
  }

  for (const o of run.opportunities) {
    const opportunityDbId = randomUUID();

    const { error: oppError } = await supabase.from("opportunities").insert({
      id: opportunityDbId,
      run_id: run.id,
      product_name: o.candidate.name,
      category: o.candidate.category,
      problem_solved: o.candidate.problemSolved,
      target_customer: o.candidate.targetCustomer,
      marketplace_recommendation: o.marketplaceRecommendation,
      supplier_country: o.candidate.supplierCountryHint,
      capital_required: o.capitalRequired,
      test_quantity: o.actionPlan.testQuantity ?? null,
      beginner_difficulty: o.beginnerDifficulty,
      decision: o.decision,
      decision_narrative: o.decisionNarrative,
      action_plan: o.actionPlan,
      user_fit: o.userFit,
      created_at: o.createdAt,
    });
    if (oppError && isMissingColumnError(oppError.message)) {
      // Migration adding `user_fit` hasn't been applied to this project yet — retry
      // without it so persistence still works. Run the migration to enable full
      // User Fit round-tripping.
      const { error: retryErr } = await supabase.from("opportunities").insert({
        id: opportunityDbId,
        run_id: run.id,
        product_name: o.candidate.name,
        category: o.candidate.category,
        problem_solved: o.candidate.problemSolved,
        target_customer: o.candidate.targetCustomer,
        marketplace_recommendation: o.marketplaceRecommendation,
        supplier_country: o.candidate.supplierCountryHint,
        capital_required: o.capitalRequired,
        test_quantity: o.actionPlan.testQuantity ?? null,
        beginner_difficulty: o.beginnerDifficulty,
        decision: o.decision,
        decision_narrative: o.decisionNarrative,
        action_plan: o.actionPlan,
        created_at: o.createdAt,
      });
      if (retryErr) throw new Error(`Failed to save opportunity: ${retryErr.message}`);
    } else if (oppError) {
      throw new Error(`Failed to save opportunity: ${oppError.message}`);
    }

    const { error: scoreError } = await supabase.from("opportunity_scores").insert({
      opportunity_id: opportunityDbId,
      total: o.score.total,
      components: o.score.components,
      data_confidence: o.score.dataConfidence,
      profit_confidence: o.score.profitConfidence,
      supplier_confidence: o.score.supplierConfidence,
      regulatory_confidence: o.score.regulatoryConfidence,
    });
    if (scoreError) throw new Error(`Failed to save opportunity_scores: ${scoreError.message}`);

    const f = o.financials;
    const { error: finError } = await supabase.from("financial_models").insert({
      opportunity_id: opportunityDbId,
      landed_cost_per_unit: f.landedCostPerUnit,
      total_cost_per_unit: f.totalCostPerUnit,
      contribution_margin_per_unit: f.contributionMarginPerUnit,
      contribution_margin_percent: f.contributionMarginPercent,
      gross_margin_percent: f.grossMarginPercent,
      break_even_units: isFinite(f.breakEvenUnits) ? f.breakEvenUnits : null,
      break_even_revenue: isFinite(f.breakEvenRevenue) ? f.breakEvenRevenue : null,
      cash_required_for_test: f.cashRequiredForTest,
      roi_percent_at_test_quantity: f.roiPercentAtTestQuantity,
      max_affordable_inventory_units: f.maxAffordableInventoryUnits,
    });
    if (finError) throw new Error(`Failed to save financial_models: ${finError.message}`);

    if (o.contradictions.length > 0) {
      const fullRows = o.contradictions.map((c) => ({
        id: c.id,
        opportunity_id: opportunityDbId,
        pattern_matched: c.patternMatched,
        narrative: c.narrative,
        forces_decision: c.forcesDecision ?? null,
        caps_decision: c.capsDecision ?? null,
        type: c.type,
        severity: c.severity,
        evidence_summary: c.evidenceSummary,
        affected_metrics: c.affectedMetrics,
        recommended_action: c.recommendedAction,
      }));
      const { error: contraError } = await supabase.from("contradiction_findings").insert(fullRows);
      if (contraError && isMissingColumnError(contraError.message)) {
        // Migration adding severity/type/etc. hasn't been applied yet — retry with
        // just the original columns so persistence still works.
        const basicRows = o.contradictions.map((c) => ({
          id: c.id,
          opportunity_id: opportunityDbId,
          pattern_matched: c.patternMatched,
          narrative: c.narrative,
          forces_decision: c.forcesDecision ?? null,
          caps_decision: c.capsDecision ?? null,
        }));
        const { error: retryErr } = await supabase.from("contradiction_findings").insert(basicRows);
        if (retryErr) throw new Error(`Failed to save contradiction_findings: ${retryErr.message}`);
      } else if (contraError) {
        throw new Error(`Failed to save contradiction_findings: ${contraError.message}`);
      }
    }

    if (o.decision === "REJECT") {
      const { error: killError } = await supabase.from("kill_list_entries").insert({
        opportunity_id: opportunityDbId,
        reason_codes:
          o.contradictions.length > 0 ? o.contradictions.map((c) => c.patternMatched) : ["low_score"],
      });
      if (killError) throw new Error(`Failed to save kill_list_entries: ${killError.message}`);
    }

    if (o.evidence.length > 0) {
      const fullEvidenceRows = o.evidence.map((e) => ({
        id: e.id,
        opportunity_id: opportunityDbId,
        source_id: sourceIdMap.get(e.source.id) ?? null,
        data_type: e.dataType,
        classification: e.classification,
        claim: e.claim,
        value: e.value === undefined ? null : String(e.value),
        unit: e.unit ?? null,
        confidence: e.confidence,
        assumptions: e.assumptions ?? null,
        collected_at: e.collectedAt,
        freshness_note: e.freshnessNote ?? null,
        query: e.query ?? null,
        raw_reference: e.rawReference ?? null,
      }));
      const { error: evidenceError } = await supabase.from("evidence").insert(fullEvidenceRows);
      if (evidenceError && isMissingColumnError(evidenceError.message)) {
        // Migration adding query/raw_reference hasn't been applied to this project
        // yet — retry without them so persistence still works.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const basicRows = fullEvidenceRows.map(({ query, raw_reference, ...rest }) => rest);
        const { error: retryErr } = await supabase.from("evidence").insert(basicRows);
        if (retryErr) throw new Error(`Failed to save evidence: ${retryErr.message}`);
      } else if (evidenceError) {
        throw new Error(`Failed to save evidence: ${evidenceError.message}`);
      }
    }
  }
}

// Nested select matching the schema's foreign key relationships. One round trip
// reconstructs everything needed to rebuild ResearchRun[] objects.
const RUN_SELECT = `
  id, raw_message, parsed_request, narrative, status, created_at,
  opportunities (
    id, product_name, category, problem_solved, target_customer,
    marketplace_recommendation, supplier_country, capital_required,
    beginner_difficulty, decision, decision_narrative, action_plan, user_fit, created_at,
    opportunity_scores ( total, components, data_confidence, profit_confidence, supplier_confidence, regulatory_confidence ),
    financial_models ( landed_cost_per_unit, total_cost_per_unit, contribution_margin_per_unit, contribution_margin_percent, gross_margin_percent, break_even_units, break_even_revenue, cash_required_for_test, roi_percent_at_test_quantity, max_affordable_inventory_units ),
    contradiction_findings ( id, pattern_matched, narrative, forces_decision, caps_decision, type, severity, evidence_summary, affected_metrics, recommended_action ),
    evidence ( id, data_type, classification, claim, value, unit, confidence, assumptions, collected_at, freshness_note, query, raw_reference, sources ( id, name, url, provider_key ) )
  )
`;

// Fallback SELECT for projects that haven't run the User Fit / severity migration
// yet — same shape minus the new columns, so reads still work either way.
const RUN_SELECT_LEGACY = `
  id, raw_message, parsed_request, narrative, status, created_at,
  opportunities (
    id, product_name, category, problem_solved, target_customer,
    marketplace_recommendation, supplier_country, capital_required,
    beginner_difficulty, decision, decision_narrative, action_plan, created_at,
    opportunity_scores ( total, components, data_confidence, profit_confidence, supplier_confidence, regulatory_confidence ),
    financial_models ( landed_cost_per_unit, total_cost_per_unit, contribution_margin_per_unit, contribution_margin_percent, gross_margin_percent, break_even_units, break_even_revenue, cash_required_for_test, roi_percent_at_test_quantity, max_affordable_inventory_units ),
    contradiction_findings ( id, pattern_matched, narrative, forces_decision, caps_decision ),
    evidence ( id, data_type, classification, claim, value, unit, confidence, assumptions, collected_at, freshness_note, sources ( id, name, url, provider_key ) )
  )
`;

const DEFAULT_USER_FIT = {
  userFitScore: 0,
  profileFit: 0,
  capitalFit: 0,
  complexityFit: 0,
  riskFit: 0,
  recommendedTestAllocationPercent: 0,
  recommendedTestSize: 0,
  recommendedTestBudget: 0,
  recommendedReserve: 0,
  capitalAtRiskPercent: 0,
  notes: ["User Fit was not persisted for this run (saved before the User Fit migration)."],
};

// PostgREST returns deeply nested, loosely-typed row shapes that vary depending on
// which migration state a project is in (see RUN_SELECT vs RUN_SELECT_LEGACY above).
// A single documented `any` alias here is more honest than scattering per-line
// eslint-disable comments across every nested .map() callback below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseRow = any;

function rowToRun(row: SupabaseRow): ResearchRun {
  const opportunities: Opportunity[] = (row.opportunities ?? []).map((o: SupabaseRow) => {
    const score = o.opportunity_scores?.[0] ?? o.opportunity_scores ?? {};
    const fin = o.financial_models?.[0] ?? o.financial_models ?? {};
    const contradictions: ContradictionFinding[] = (o.contradiction_findings ?? []).map((c: SupabaseRow) => ({
      id: c.id,
      type: c.type ?? c.pattern_matched?.toUpperCase() ?? "UNKNOWN",
      severity: c.severity ?? "MEDIUM",
      patternMatched: c.pattern_matched,
      narrative: c.narrative,
      evidenceSummary: c.evidence_summary ?? "",
      affectedMetrics: c.affected_metrics ?? [],
      recommendedAction: c.recommended_action ?? "",
      forcesDecision: c.forces_decision ?? undefined,
      capsDecision: c.caps_decision ?? undefined,
    }));
    const evidence: Evidence[] = (o.evidence ?? []).map((e: SupabaseRow) => {
      const src = e.sources ?? {};
      const source: Source = { id: src.id, name: src.name, url: src.url ?? undefined, providerKey: src.provider_key };
      return {
        id: e.id,
        dataType: e.data_type,
        classification: e.classification,
        claim: e.claim,
        value: e.value ?? undefined,
        unit: e.unit ?? undefined,
        source,
        collectedAt: e.collected_at,
        freshnessNote: e.freshness_note ?? undefined,
        confidence: e.confidence,
        assumptions: e.assumptions ?? undefined,
        query: e.query ?? undefined,
        rawReference: e.raw_reference ?? undefined,
      } as Evidence;
    });

    const opportunity: Opportunity = {
      id: o.id,
      runId: row.id,
      candidate: {
        // Not all CandidateProduct fields are persisted (they're only needed during
        // the initial computation in master-agent.ts, not for display afterward).
        id: o.id,
        name: o.product_name,
        category: o.category,
        problemSolved: o.problem_solved ?? "",
        targetCustomer: o.target_customer ?? "",
        supplierCountryHint: o.supplier_country ?? "",
        basePriceHint: 0,
        unitWeightKgHint: 0,
        mockProfile: "solid_beginner",
      },
      targetMarket: "US",
      marketplaceRecommendation: o.marketplace_recommendation ?? "",
      // Per-agent traces aren't persisted in Phase 1.5 (only their aggregated
      // outputs — score, financials, evidence, contradictions — are).
      agentResults: [],
      evidence,
      contradictions,
      financials: {
        landedCostPerUnit: fin.landed_cost_per_unit ?? 0,
        totalCostPerUnit: fin.total_cost_per_unit ?? 0,
        contributionMarginPerUnit: fin.contribution_margin_per_unit ?? 0,
        contributionMarginPercent: fin.contribution_margin_percent ?? 0,
        grossMarginPercent: fin.gross_margin_percent ?? 0,
        breakEvenUnits: fin.break_even_units ?? Infinity,
        breakEvenRevenue: fin.break_even_revenue ?? Infinity,
        cashRequiredForTest: fin.cash_required_for_test ?? 0,
        roiPercentAtTestQuantity: fin.roi_percent_at_test_quantity ?? 0,
        maxAffordableInventoryUnits: fin.max_affordable_inventory_units ?? 0,
      },
      score: {
        total: score.total ?? 0,
        components: score.components ?? [],
        dataConfidence: score.data_confidence ?? 0,
        profitConfidence: score.profit_confidence ?? 0,
        supplierConfidence: score.supplier_confidence ?? 0,
        regulatoryConfidence: score.regulatory_confidence ?? 0,
      },
      decision: o.decision,
      decisionNarrative: o.decision_narrative,
      actionPlan: o.action_plan,
      beginnerDifficulty: o.beginner_difficulty ?? "MEDIUM",
      capitalRequired: o.capital_required ?? 0,
      userFit: o.user_fit ?? DEFAULT_USER_FIT,
      createdAt: o.created_at,
    };
    return opportunity;
  });

  return {
    id: row.id,
    request: row.parsed_request,
    opportunities,
    createdAt: row.created_at,
    narrative: row.narrative ?? "",
  };
}

// Throws on failure (network error, Supabase outage, etc.) rather than swallowing
// it — callers decide whether to fall back to the file store. Returning [] here
// on error was the source of a real bug: it made reads silently diverge from
// writes whenever Supabase was unreachable (saves fell back to the file, but
// reads didn't, so newly-saved data appeared to not exist).
async function readAllRunsFromSupabase(): Promise<ResearchRun[]> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] | null;
  let error: { message: string } | null;
  ({ data, error } = await supabase
    .from("research_runs")
    .select(RUN_SELECT)
    .order("created_at", { ascending: true })
    .limit(50));
  if (error && isMissingColumnError(error.message)) {
    ({ data, error } = await supabase
      .from("research_runs")
      .select(RUN_SELECT_LEGACY)
      .order("created_at", { ascending: true })
      .limit(50));
  }
  if (error) throw new Error(`Failed to read runs from Supabase: ${error.message}`);
  return (data ?? []).map(rowToRun);
}

async function readRunFromSupabase(runId: string): Promise<ResearchRun | undefined> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any | null;
  let error: { message: string } | null;
  ({ data, error } = await supabase.from("research_runs").select(RUN_SELECT).eq("id", runId).maybeSingle());
  if (error && isMissingColumnError(error.message)) {
    ({ data, error } = await supabase.from("research_runs").select(RUN_SELECT_LEGACY).eq("id", runId).maybeSingle());
  }
  if (error) throw new Error(`Failed to read run from Supabase: ${error.message}`);
  return data ? rowToRun(data) : undefined;
}

// ---------------------------------------------------------------------------
// Public API (unchanged names, now async — callers must await)
// ---------------------------------------------------------------------------

export async function saveRun(run: ResearchRun): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await saveRunToSupabase(run);
      return;
    } catch (err) {
      console.error("Supabase save failed, falling back to local file store:", err);
    }
  }
  const runs = readAllRunsFromFile();
  runs.push(run);
  writeAllRunsToFile(runs);
}

export async function loadRun(runId: string): Promise<ResearchRun | undefined> {
  if (isSupabaseConfigured()) {
    try {
      return await readRunFromSupabase(runId);
    } catch (err) {
      console.error("Supabase read failed, falling back to local file store:", err);
    }
  }
  return readAllRunsFromFile().find((r) => r.id === runId);
}

export async function loadAllRuns(): Promise<ResearchRun[]> {
  if (isSupabaseConfigured()) {
    try {
      return await readAllRunsFromSupabase();
    } catch (err) {
      console.error("Supabase read failed, falling back to local file store:", err);
    }
  }
  return readAllRunsFromFile();
}

export async function loadLatestRun(): Promise<ResearchRun | undefined> {
  const runs = await loadAllRuns();
  return runs[runs.length - 1];
}
