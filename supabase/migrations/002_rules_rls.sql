-- =====================================================================
-- Regras de integridade, auditoria e RLS
-- =====================================================================

-- ---------- Cálculo e snapshot de percentuais nas vendas ----------
create or replace function public.sales_before_write() returns trigger
language plpgsql as $$
declare
  s_percent numeric;
  financial_changed boolean := false;
  r text;
begin
  if tg_op = 'INSERT' then
    -- snapshot do percentual do corretor vigente nas configurações
    if new.broker_percent is null then
      select broker_percent into s_percent from public.settings where user_id = new.user_id;
      new.broker_percent := coalesce(s_percent, 70);
    end if;
  else
    -- alterações financeiras exigem justificativa e geram histórico
    r := nullif(btrim(coalesce(new.change_reason, '')), '');
    financial_changed :=
         new.premium is distinct from old.premium
      or new.insurer_percent is distinct from old.insurer_percent
      or new.broker_percent is distinct from old.broker_percent
      or new.status is distinct from old.status
      or new.sale_date is distinct from old.sale_date;
    if financial_changed and r is null then
      raise exception 'Alteração de valores, percentuais, data ou status exige justificativa (change_reason).';
    end if;
    if financial_changed then
      insert into public.audit_logs(user_id, table_name, record_id, action, field, old_value, new_value, justification)
      select new.user_id, 'sales', new.id, 'UPDATE', f.k, f.o, f.n, r
      from (values
        ('premium', old.premium::text, new.premium::text),
        ('insurer_percent', old.insurer_percent::text, new.insurer_percent::text),
        ('broker_percent', old.broker_percent::text, new.broker_percent::text),
        ('status', old.status, new.status),
        ('sale_date', old.sale_date::text, new.sale_date::text)
      ) as f(k, o, n)
      where f.o is distinct from f.n;
    end if;
    new.updated_at := now();
  end if;

  new.gross_commission := round(new.premium * new.insurer_percent / 100, 2);
  new.net_commission   := round(new.gross_commission * new.broker_percent / 100, 2);
  new.change_reason := null;
  return new;
end $$;

create trigger sales_before_write_trg before insert or update on public.sales
for each row execute function public.sales_before_write();

-- ---------- Proibir exclusão destrutiva ----------
create or replace function public.sales_prevent_delete() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.commission_receipts where sale_id = old.id)
     or exists (select 1 from public.cancellations where sale_id = old.id)
     or exists (select 1 from public.reversal_transactions where sale_id = old.id)
     or exists (select 1 from public.production_reconciliation_items where sale_id = old.id and linked_manually) then
    raise exception 'Venda com movimentações ou vínculos não pode ser apagada. Use cancelamento.';
  end if;
  insert into public.audit_logs(user_id, table_name, record_id, action, old_value)
  values (old.user_id, 'sales', old.id, 'DELETE', to_jsonb(old)::text);
  return old;
end $$;
create trigger sales_prevent_delete_trg before delete on public.sales
for each row execute function public.sales_prevent_delete();

create or replace function public.clients_prevent_delete() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.sales where client_id = old.id) then
    raise exception 'Cliente com vendas vinculadas não pode ser excluído. Arquive o cliente.';
  end if;
  return old;
end $$;
create trigger clients_prevent_delete_trg before delete on public.clients
for each row execute function public.clients_prevent_delete();

create or replace function public.block_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'Registros de % não podem ser apagados. Use ajuste/estorno com justificativa.', tg_table_name;
end $$;
create trigger cancellations_no_delete before delete on public.cancellations
for each row execute function public.block_delete();
create trigger reversals_no_delete before delete on public.reversal_transactions
for each row execute function public.block_delete();

create or replace function public.receipts_prevent_delete() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.cancellations where sale_id = old.sale_id) then
    raise exception 'Recebimentos não podem ser apagados após o cancelamento da venda.';
  end if;
  return old;
end $$;
create trigger receipts_prevent_delete_trg before delete on public.commission_receipts
for each row execute function public.receipts_prevent_delete();

-- ---------- Recebimentos: limite do valor devido ----------
create or replace function public.receipts_check_limit() returns trigger
language plpgsql as $$
declare
  due numeric; prev numeric; st text;
begin
  select net_commission, status into due, st from public.sales where id = new.sale_id;
  if st = 'cancelada' and nullif(btrim(coalesce(new.over_limit_justification,'')),'') is null then
    raise exception 'Venda cancelada: recebimento só é aceito como ajuste justificado (over_limit_justification).';
  end if;
  select coalesce(sum(amount),0) into prev from public.commission_receipts
   where sale_id = new.sale_id and (tg_op = 'INSERT' or id <> new.id);
  if st <> 'cancelada' and prev + new.amount > due and nullif(btrim(coalesce(new.over_limit_justification,'')),'') is null then
    raise exception 'Recebimento acima do valor devido (devido %, já recebido %). Informe justificativa de ajuste.', due, prev;
  end if;
  return new;
end $$;
create trigger receipts_check_limit_trg before insert or update on public.commission_receipts
for each row execute function public.receipts_check_limit();

-- ---------- Cancelamento: snapshot, status e comissão perdida ----------
create or replace function public.cancellations_before_insert() returns trigger
language plpgsql as $$
declare
  rec numeric; netc numeric;
begin
  select net_commission into netc from public.sales where id = new.sale_id;
  select coalesce(sum(amount),0) into rec from public.commission_receipts where sale_id = new.sale_id;
  new.net_at_cancellation := netc;
  new.received_at_cancellation := rec;
  -- parte nunca recebida é "perdida/não realizada" (não é estorno)
  new.lost_commission := greatest(netc - rec, 0);
  return new;
end $$;
create trigger cancellations_before_insert_trg before insert on public.cancellations
for each row execute function public.cancellations_before_insert();

create or replace function public.cancellations_after_insert() returns trigger
language plpgsql as $$
begin
  update public.sales set status = 'cancelada', change_reason = 'Cancelamento registrado'
   where id = new.sale_id and status <> 'cancelada';
  insert into public.audit_logs(user_id, table_name, record_id, action, new_value, justification)
  values (new.user_id, 'cancellations', new.id, 'INSERT',
          'perdida=' || new.lost_commission || '; recebido=' || new.received_at_cancellation, new.reason);
  return new;
end $$;
create trigger cancellations_after_insert_trg after insert on public.cancellations
for each row execute function public.cancellations_after_insert();

-- ---------- Estornos: só sobre dinheiro efetivamente recebido ----------
create or replace function public.reversals_check() returns trigger
language plpgsql as $$
declare
  rec numeric; other numeric;
begin
  select coalesce(sum(amount),0) into rec from public.commission_receipts where sale_id = new.sale_id;
  if rec <= 0 then
    raise exception 'Não existe estorno de dinheiro que nunca foi recebido (nenhum recebimento nesta venda).';
  end if;
  if new.status <> 'cancelado' then
    select coalesce(sum(amount),0) into other from public.reversal_transactions
     where sale_id = new.sale_id and status <> 'cancelado' and (tg_op = 'INSERT' or id <> new.id);
    if other + new.amount > rec then
      raise exception 'Estornos (%) excedem o total recebido (%).', other + new.amount, rec;
    end if;
  end if;
  if btrim(coalesce(new.justification,'')) = '' then
    raise exception 'Justificativa obrigatória para estorno.';
  end if;
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return new;
end $$;
create trigger reversals_check_trg before insert or update on public.reversal_transactions
for each row execute function public.reversals_check();

-- ---------- Auditoria genérica ----------
create or replace function public.audit_generic() returns trigger
language plpgsql as $$
declare
  k text; o jsonb; n jsonb; uid uuid; rid uuid;
begin
  if tg_op = 'INSERT' then
    n := to_jsonb(new); uid := new.user_id; rid := (n->>'id')::uuid;
    insert into public.audit_logs(user_id, table_name, record_id, action, new_value)
    values (uid, tg_table_name, rid, 'INSERT', n::text);
  elsif tg_op = 'UPDATE' then
    o := to_jsonb(old); n := to_jsonb(new); uid := new.user_id;
    rid := coalesce((n->>'id')::uuid, null);
    for k in select jsonb_object_keys(n) loop
      if k not in ('updated_at') and (o->k) is distinct from (n->k) then
        insert into public.audit_logs(user_id, table_name, record_id, action, field, old_value, new_value, justification)
        values (uid, tg_table_name, rid, 'UPDATE', k, o->>k, n->>k,
                coalesce(n->>'justification', n->>'over_limit_justification'));
      end if;
    end loop;
  end if;
  return null;
end $$;

create trigger audit_receipts after insert or update on public.commission_receipts
for each row execute function public.audit_generic();
create trigger audit_reversals after insert or update on public.reversal_transactions
for each row execute function public.audit_generic();
create trigger audit_clients after insert or update on public.clients
for each row execute function public.audit_generic();
create trigger audit_settings after insert or update on public.settings
for each row execute function public.audit_generic();
create trigger audit_reports after insert on public.production_reports
for each row execute function public.audit_generic();
create trigger audit_report_items after update on public.production_report_items
for each row execute function public.audit_generic();
create trigger audit_recon_items after update on public.production_reconciliation_items
for each row execute function public.audit_generic();
create trigger audit_recon after update on public.production_reconciliations
for each row execute function public.audit_generic();

-- Percentual alterado nas configurações NUNCA recalcula vendas antigas:
-- não existe trigger em settings que toque em sales (regra obrigatória 4.1).

-- ---------- View de situação financeira por venda ----------
create or replace view public.sale_financials with (security_invoker = true) as
select
  s.id as sale_id, s.user_id, s.status, s.net_commission,
  coalesce(r.received, 0) as received,
  case when s.status = 'cancelada' then 0 else s.net_commission end as valid_net,
  case when s.status = 'cancelada' then 0
       else greatest(s.net_commission - coalesce(r.received,0), 0) end as pending_balance,
  case
    when s.status = 'cancelada' then 'cancelada'
    when coalesce(r.received,0) = 0 then 'pendente'
    when coalesce(r.received,0) < s.net_commission then 'parcialmente_recebido'
    else 'recebido' end as financial_status
from public.sales s
left join (select sale_id, sum(amount) received from public.commission_receipts group by sale_id) r
  on r.sale_id = s.id;

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array[
    'settings','insurers','products','clients','sales','commission_receipts','cancellations',
    'reversal_transactions','goals','holidays','audit_logs','production_reports',
    'production_report_items','production_reconciliations','production_reconciliation_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (user_id = auth.uid())', t||'_sel', t);
    if t <> 'audit_logs' then
      execute format('create policy %I on public.%I for insert with check (user_id = auth.uid())', t||'_ins', t);
      execute format('create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t||'_upd', t);
      execute format('create policy %I on public.%I for delete using (user_id = auth.uid())', t||'_del', t);
    end if;
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy profiles_sel on public.profiles for select using (id = auth.uid());
create policy profiles_upd on public.profiles for update using (id = auth.uid());
create policy profiles_ins on public.profiles for insert with check (id = auth.uid());

-- audit_logs: o frontend só lê; triggers (security definer) escrevem
alter function public.audit_generic() security definer set search_path = public;
alter function public.sales_before_write() security definer set search_path = public;
alter function public.sales_prevent_delete() security definer set search_path = public;
alter function public.cancellations_after_insert() security definer set search_path = public;
revoke insert, update, delete on public.audit_logs from anon, authenticated;

-- ---------- Storage privado para PDFs originais ----------
insert into storage.buckets (id, name, public) values ('production-reports','production-reports', false)
on conflict (id) do nothing;

create policy "pr_files_select" on storage.objects for select
  using (bucket_id = 'production-reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pr_files_insert" on storage.objects for insert
  with check (bucket_id = 'production-reports' and (storage.foldername(name))[1] = auth.uid()::text);
