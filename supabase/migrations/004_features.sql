-- Conversão de leads (só registro), notas rápidas e notificações de apólices pendentes.

create table public.conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reference_month date not null,
  leads_received int not null check (leads_received >= 0),
  sales_converted int not null check (sales_converted >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, reference_month)
);

create table public.quick_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_sale_idx on public.notifications (sale_id, created_at desc);

do $$ declare t text; begin
  foreach t in array array['conversions','quick_notes','notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (user_id = auth.uid())', t||'_sel', t);
    execute format('create policy %I on public.%I for insert with check (user_id = auth.uid())', t||'_ins', t);
    execute format('create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t||'_upd', t);
    execute format('create policy %I on public.%I for delete using (user_id = auth.uid())', t||'_del', t);
  end loop;
end $$;

-- Gera 1 aviso por apólice pendente a cada 5 horas e baixa os avisos de apólices que já saíram de "pendente".
create or replace function public.generate_pending_notifications(p_user uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update notifications set read_at = now()
   where read_at is null and (p_user is null or user_id = p_user)
     and sale_id in (select id from sales where status <> 'pendente');

  insert into notifications (user_id, sale_id, message)
  select s.user_id, s.id,
         'Apólice pendente: ' || c.full_name || coalesce(' · proposta ' || s.proposal_number, '') || '. Veja se já foi emitida.'
    from sales s join clients c on c.id = s.client_id
   where s.status = 'pendente' and (p_user is null or s.user_id = p_user)
     and not exists (select 1 from notifications x where x.sale_id = s.id and x.created_at > now() - interval '5 hours');
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.refresh_my_notifications()
returns int language sql security definer set search_path = public as $$
  select public.generate_pending_notifications(auth.uid());
$$;

revoke all on function public.generate_pending_notifications(uuid) from public, anon, authenticated;
revoke all on function public.refresh_my_notifications() from public, anon;
grant execute on function public.refresh_my_notifications() to authenticated;

-- Agendamento no servidor (roda de hora em hora; a regra das 5 h está na função). Exige a extensão pg_cron.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('pending-policy-notifications', '0 * * * *', 'select public.generate_pending_notifications()');
exception when others then
  raise notice 'pg_cron indisponível (ative em Database > Extensions). O sistema também gera os avisos enquanto estiver aberto.';
end $$;
