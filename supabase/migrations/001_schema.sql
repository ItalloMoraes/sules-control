-- =====================================================================
-- SULES CONTROL — Esquema do banco (PostgreSQL / Supabase)
-- Fuso padrão: America/Recife. Conta individual: toda linha pertence a user_id.
-- =====================================================================
create extension if not exists pgcrypto;

-- Utilitário: dono da linha
-- (default auth.uid() preenche user_id automaticamente nos inserts do frontend)

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  broker_name text,
  broker_percent numeric(6,3) not null default 70 check (broker_percent between 0 and 100),
  default_insurer_id uuid,
  suggested_insurer_percent numeric(6,3) default 20 check (suggested_insurer_percent between 0 and 100),
  theme text not null default 'dark' check (theme in ('dark','light')),
  goal_net_basis text not null default 'generated' check (goal_net_basis in ('generated','after_reversals')),
  preferences jsonb not null default '{}'::jsonb,
  financial jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.insurers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.settings
  add constraint settings_default_insurer_fk
  foreign key (default_insurer_id) references public.insurers(id) on delete set null;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  cpf text,
  phone text,
  email text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index clients_user_name_idx on public.clients (user_id, lower(full_name));

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  insurer_id uuid not null references public.insurers(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  sale_date date not null,                       -- data da venda (apuração)
  policy_start_date date,                        -- início de vigência (informativo)
  vehicle_description text,
  plate text,
  proposal_number text,
  policy_number text,
  endorsement_number text,
  premium numeric(14,2) not null check (premium >= 0),
  insurer_percent numeric(6,3) not null check (insurer_percent between 0 and 100),
  broker_percent numeric(6,3) not null check (broker_percent between 0 and 100),
  gross_commission numeric(14,2) not null default 0,
  net_commission numeric(14,2) not null default 0,
  origin text not null check (origin in ('digital_suhai','venda_propria')),
  status text not null default 'pendente' check (status in ('pendente','emitida','cancelada')),
  notes text,
  change_reason text,                            -- justificativa transitória (limpa pelo trigger)
  created_at timestamptz not null default now(), -- ordenação da prévia do dashboard
  updated_at timestamptz not null default now()
);
create index sales_user_date_idx on public.sales (user_id, sale_date);
create index sales_user_created_idx on public.sales (user_id, created_at desc);
create index sales_proposal_idx on public.sales (user_id, proposal_number);
create index sales_policy_idx on public.sales (user_id, policy_number);

create table public.commission_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  received_at date not null,
  reference text,
  notes text,
  over_limit_justification text,                 -- obrigatório para exceder o valor devido
  created_at timestamptz not null default now()
);
create index receipts_sale_idx on public.commission_receipts (sale_id);
create index receipts_user_date_idx on public.commission_receipts (user_id, received_at);

create table public.cancellations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete restrict,
  cancelled_at date not null,
  reason text,
  received_at_cancellation numeric(14,2) not null default 0, -- snapshot do recebido
  net_at_cancellation numeric(14,2) not null default 0,      -- snapshot da comissão original
  lost_commission numeric(14,2) not null default 0,          -- parte não recebida (perdida)
  notes text,
  created_at timestamptz not null default now(),
  unique (sale_id)
);

create table public.reversal_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cancellation_id uuid not null references public.cancellations(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  reversal_date date,                            -- data do impacto financeiro
  status text not null default 'pendente' check (status in ('pendente','efetivado','cancelado')),
  justification text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reversal_effective_needs_date check (status <> 'efetivado' or reversal_date is not null)
);
create index reversals_sale_idx on public.reversal_transactions (sale_id);
create index reversals_user_date_idx on public.reversal_transactions (user_id, reversal_date);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null,                           -- sempre dia 1 do mês
  target_count integer,
  target_premium numeric(14,2),
  target_gross numeric(14,2),
  target_net numeric(14,2),
  net_basis text not null default 'generated' check (net_basis in ('generated','after_reversals')),
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  description text,
  unique (user_id, day)
);

create table public.audit_logs (
  id bigserial primary key,
  user_id uuid not null,
  table_name text not null,
  record_id uuid,
  action text not null,                          -- INSERT | UPDATE | DELETE | evento
  field text,
  old_value text,
  new_value text,
  justification text,
  created_at timestamptz not null default now()
);
create index audit_record_idx on public.audit_logs (user_id, table_name, record_id, created_at desc);

-- ---------------------------------------------------------------------
-- Conferência mensal de produção
-- ---------------------------------------------------------------------
create table public.production_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  insurer_id uuid references public.insurers(id) on delete set null,
  source text not null default 'Digital Suhai',
  reference_month date not null,                 -- dia 1 do mês de referência
  period_start date,
  period_end date,
  file_name text not null,
  file_hash text not null,                       -- SHA-256 do PDF (evita reimportar)
  storage_path text,
  imported_at timestamptz not null default now(),
  reconciliation_status text not null default 'em_andamento'
    check (reconciliation_status in ('em_andamento','confirmada')),
  unique (user_id, file_hash)
);

create table public.production_report_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  report_id uuid not null references public.production_reports(id) on delete cascade,
  line_no integer not null,
  item_key text not null,                        -- chave de identidade p/ duplicidade
  client_name text,
  policy_start_date date,                        -- Dt. In. Vig. (NÃO é sale_date)
  proposal_number text,
  policy_number text,
  endorsement_number text,
  product text,
  movement_code text check (movement_code in ('N','EN','CN','R','ER','CR')),
  vigencia_start date,
  vigencia_end date,
  installments integer,
  premium numeric(14,2),
  commission_percent numeric(8,3),
  commission numeric(14,2),                      -- preserva negativos e zeros
  raw jsonb not null default '{}'::jsonb,        -- dados originais extraídos (auditoria)
  corrected jsonb not null default '{}'::jsonb,  -- correções manuais
  created_at timestamptz not null default now()
);
create index report_items_report_idx on public.production_report_items (report_id);
create index report_items_key_idx on public.production_report_items (user_id, item_key);

create table public.production_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  report_id uuid not null references public.production_reports(id) on delete cascade,
  summary jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (report_id)
);

create table public.production_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reconciliation_id uuid not null references public.production_reconciliations(id) on delete cascade,
  report_item_id uuid references public.production_report_items(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  classification text not null check (classification in
    ('conferido','divergencia','nao_cadastrado','nao_consta_no_relatorio','movimentacao_especial','duplicado')),
  match_rule text,
  differences jsonb not null default '[]'::jsonb,
  justification text,
  analyzed boolean not null default false,
  linked_manually boolean not null default false,
  updated_at timestamptz not null default now()
);
create index recon_items_idx on public.production_reconciliation_items (reconciliation_id);
