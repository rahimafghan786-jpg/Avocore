# Avocore — Database (Phase 1)

Full schema lives in `supabase/migrations/0001_init.sql`. Postgres, designed for Supabase
(row-level security ready, `auth.users` as the identity source).

**Status in Phase 1:** the schema is written and migration-ready, but the running MVP does not yet
write to a live Supabase project (none is provisioned — see `ROADMAP.md`). The Master Agent
persists generated research runs to a local JSON file (`.avocore-data/runs.json`, gitignored)
instead of an in-memory cache — this was a deliberate fix, not the original design: Next.js
dispatches requests across isolated worker threads that don't reliably share in-memory
module/`globalThis` state, so a plain in-memory cache silently lost data depending on which thread
handled a given request. A file on disk is consistent regardless of threading. Wiring
`lib/master-agent.ts` output into the tables below instead of this file is a small, mechanical
Phase 1.5 step once you provision a Supabase project and set the env vars.

## Tables (Phase 1 subset of the full spec)

Only the tables needed for the one milestone workflow are included now. The full spec's larger list
(suppliers, tariffs, marketplace fees, learning loop, etc.) is deferred to Phase 2/3 and added
incrementally — see `ROADMAP.md`.

### Identity
- `user_profiles` — one row per authenticated user. `id` references `auth.users`.
- `budgets` — capital, max acceptable loss, monthly budget, risk tolerance. One active row per user.

### Research
- `research_runs` — one row per Master Agent invocation. Stores the parsed request, the research
  plan, timestamps, and status.
- `opportunities` — one row per candidate product surfaced by a run. Holds product name, problem
  solved, target customer, marketplace recommendation, supplier country, capital required, test
  quantity, beginner difficulty, and the final `decision`.
- `opportunity_scores` — the full component breakdown behind each opportunity's score (demand
  quality, competition, margin potential, etc.), so nothing is hidden.
- `financial_models` — the computed landed cost / margin / breakeven / ROI numbers behind an
  opportunity.

### Evidence
- `sources` — a source referenced by evidence (provider name, URL/reference, type).
- `evidence` — every factual claim used anywhere in a run: classification
  (`MOCK|ESTIMATED|OBSERVED|INFERRED|VERIFIED`), confidence, collection timestamp, freshness,
  assumptions, and a foreign key to the `sources` row and the `opportunities` row it supports.

### Agents
- `agent_runs` — one row per specialist agent execution within a research run (agent name, input,
  duration, status).
- `agent_results` — the structured `AgentResult` JSON each agent produced, plus which evidence rows
  it attached.
- `contradiction_findings` — conflicts detected between agent results for an opportunity, and the
  resulting narrative used by the decision engine.

### Decisions
- `decisions` — the final GO/TEST/INVESTIGATE/WAIT/REJECT for an opportunity, the reasoning text,
  and (for TEST) the structured test plan (quantity, budget, success/failure criteria).
- `kill_list_entries` — opportunities explicitly rejected, with reason codes, so the same dead end
  isn't re-surfaced without new evidence.

## Conventions

- Every table has `created_at timestamptz default now()`.
- Every fact-bearing table has explicit **provenance** — either a direct FK to `evidence`/`sources`,
  or an explicit `data_classification` enum column. Nothing is allowed to look like a verified fact
  without a classification.
- `numeric` is used for all money/percentage columns, never `float`, to keep financial math exact.
- Row-level security: every user-scoped table filters on `auth.uid() = user_id`. Policies are
  defined in the migration but should be re-verified before any production launch.
