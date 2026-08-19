-- Avocore Phase 1 schema
-- Postgres / Supabase. Row-level security policies included but should be re-reviewed
-- before any production launch (see DATABASE.md).

create extension if not exists "pgcrypto";

-- ==========================================================================
-- IDENTITY
-- ==========================================================================

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  market text not null default 'US',
  created_at timestamptz not null default now()
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  available_capital numeric not null,
  max_acceptable_loss numeric,
  monthly_budget numeric,
  desired_profit numeric,
  risk_tolerance text check (risk_tolerance in ('low', 'medium', 'high')) default 'low',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ==========================================================================
-- RESEARCH
-- ==========================================================================

create table if not exists research_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  raw_message text not null,
  parsed_request jsonb not null,
  narrative text,
  status text not null default 'completed' check (status in ('pending', 'running', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references research_runs(id) on delete cascade,
  product_name text not null,
  category text not null,
  problem_solved text,
  target_customer text,
  marketplace_recommendation text,
  supplier_country text,
  capital_required numeric,
  test_quantity integer,
  beginner_difficulty text check (beginner_difficulty in ('LOW', 'MEDIUM', 'HIGH', 'EXTREME')),
  decision text not null check (decision in ('GO', 'TEST', 'INVESTIGATE', 'WAIT', 'REJECT')),
  decision_narrative text not null,
  action_plan jsonb,
  created_at timestamptz not null default now()
);

create table if not exists opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  total numeric not null,
  components jsonb not null, -- full transparent breakdown, never hidden
  data_confidence numeric,
  profit_confidence numeric,
  supplier_confidence numeric,
  regulatory_confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists financial_models (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  landed_cost_per_unit numeric,
  total_cost_per_unit numeric,
  contribution_margin_per_unit numeric,
  contribution_margin_percent numeric,
  gross_margin_percent numeric,
  break_even_units integer,
  break_even_revenue numeric,
  cash_required_for_test numeric,
  roi_percent_at_test_quantity numeric,
  max_affordable_inventory_units integer,
  created_at timestamptz not null default now()
);

-- ==========================================================================
-- EVIDENCE
-- ==========================================================================

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  provider_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id) on delete cascade,
  source_id uuid references sources(id),
  data_type text not null,
  classification text not null check (classification in ('VERIFIED', 'OBSERVED', 'ESTIMATED', 'INFERRED', 'MOCK')),
  claim text not null,
  value text,
  unit text,
  confidence numeric not null,
  assumptions jsonb,
  collected_at timestamptz not null default now(),
  freshness_note text
);

-- ==========================================================================
-- AGENTS
-- ==========================================================================

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references research_runs(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete cascade,
  agent_name text not null,
  status text not null default 'completed' check (status in ('pending', 'running', 'completed', 'failed')),
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists agent_results (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references agent_runs(id) on delete cascade,
  summary text,
  findings jsonb not null,
  confidence numeric,
  risk_level text check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'EXTREME')),
  risk_reasons jsonb,
  created_at timestamptz not null default now()
);

create table if not exists contradiction_findings (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  pattern_matched text not null,
  narrative text not null,
  forces_decision text check (forces_decision in ('GO', 'TEST', 'INVESTIGATE', 'WAIT', 'REJECT')),
  caps_decision text check (caps_decision in ('GO', 'TEST', 'INVESTIGATE', 'WAIT', 'REJECT')),
  created_at timestamptz not null default now()
);

-- ==========================================================================
-- DECISIONS / KILL LIST
-- ==========================================================================

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  decision text not null check (decision in ('GO', 'TEST', 'INVESTIGATE', 'WAIT', 'REJECT')),
  reasoning text not null,
  test_plan jsonb,
  created_at timestamptz not null default now()
);

create table if not exists kill_list_entries (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  reason_codes jsonb not null,
  created_at timestamptz not null default now()
);

-- ==========================================================================
-- ROW LEVEL SECURITY
-- ==========================================================================

alter table user_profiles enable row level security;
alter table budgets enable row level security;
alter table research_runs enable row level security;
alter table opportunities enable row level security;
alter table opportunity_scores enable row level security;
alter table financial_models enable row level security;
alter table evidence enable row level security;
alter table agent_runs enable row level security;
alter table agent_results enable row level security;
alter table contradiction_findings enable row level security;
alter table decisions enable row level security;
alter table kill_list_entries enable row level security;

create policy "users manage own profile" on user_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "users manage own budgets" on budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage own research runs" on research_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users read own opportunities" on opportunities
  for all using (
    exists (select 1 from research_runs r where r.id = run_id and r.user_id = auth.uid())
  );

create policy "users read own opportunity scores" on opportunity_scores
  for all using (
    exists (
      select 1 from opportunities o
      join research_runs r on r.id = o.run_id
      where o.id = opportunity_id and r.user_id = auth.uid()
    )
  );

create policy "users read own financial models" on financial_models
  for all using (
    exists (
      select 1 from opportunities o
      join research_runs r on r.id = o.run_id
      where o.id = opportunity_id and r.user_id = auth.uid()
    )
  );

create policy "users read own evidence" on evidence
  for all using (
    opportunity_id is null or exists (
      select 1 from opportunities o
      join research_runs r on r.id = o.run_id
      where o.id = opportunity_id and r.user_id = auth.uid()
    )
  );

create policy "users read own agent runs" on agent_runs
  for all using (
    exists (select 1 from research_runs r where r.id = research_run_id and r.user_id = auth.uid())
  );

create policy "users read own agent results" on agent_results
  for all using (
    exists (
      select 1 from agent_runs ar
      join research_runs r on r.id = ar.research_run_id
      where ar.id = agent_run_id and r.user_id = auth.uid()
    )
  );

create policy "users read own contradiction findings" on contradiction_findings
  for all using (
    exists (
      select 1 from opportunities o
      join research_runs r on r.id = o.run_id
      where o.id = opportunity_id and r.user_id = auth.uid()
    )
  );

create policy "users read own decisions" on decisions
  for all using (
    exists (
      select 1 from opportunities o
      join research_runs r on r.id = o.run_id
      where o.id = opportunity_id and r.user_id = auth.uid()
    )
  );

create policy "users read own kill list entries" on kill_list_entries
  for all using (
    exists (
      select 1 from opportunities o
      join research_runs r on r.id = o.run_id
      where o.id = opportunity_id and r.user_id = auth.uid()
    )
  );
