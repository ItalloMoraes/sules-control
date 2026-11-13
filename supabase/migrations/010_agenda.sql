-- Agenda (atendimentos e recontatos) e avisos só em horário comercial.
--  * Aviso de apólice pendente: a cada 6 horas, mas só entre 8h e 17h, de segunda a sexta, sem feriados.
--    Se a hora do aviso cair fora disso, ele sai às 8h30 do próximo dia útil.
--  * Aviso de agendamento: às 8h30 do dia marcado (mesma regra de dia útil).
--  * Fuso de referência: America/Recife (UTC-3, sem horário de verão).

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  kind text not null default 'recontato' check (kind in ('atendimento', 'recontato', 'outro')),
  title text not null,
  starts_at timestamptz not null,
  notes text,
  done boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index appointments_user_idx on public.appointments (user_id, starts_at);
alter table public.appointments enable row level security;
create policy appointments_sel on public.appointments for select using (user_id = auth.uid());
create policy appointments_ins on public.appointments for insert with check (user_id = auth.uid());
create policy appointments_upd on public.appointments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy appointments_del on public.appointments for delete using (user_id = auth.uid());

alter table public.notifications
  add column if not exists appointment_id uuid references public.appointments(id) on delete cascade,
  add column if not exists ref_date date;

-- Quando cada venda pendente foi avisada pela última vez. Fica separado dos avisos para que excluir um aviso
-- não faça o mesmo aviso voltar na hora.
create table public.notification_state (
  sale_id uuid primary key references public.sales(id) on delete cascade,
  user_id uuid not null,
  last_at timestamptz not null
);
alter table public.notification_state enable row level security;
insert into public.notification_state (sale_id, user_id, last_at)
  select sale_id, user_id, max(created_at) from public.notifications where sale_id is not null group by sale_id, user_id
  on conflict do nothing;

-- Feriados nacionais (datas fixas + Sexta-feira Santa; Consciência Negra desde 2024).
create or replace function public.is_national_holiday(d date)
returns boolean language plpgsql immutable as $$
declare y int := extract(year from d)::int; mo int := extract(month from d)::int; dy int := extract(day from d)::int;
        a int; b int; c int; dd int; e int; f int; g int; h int; i int; k int; l int; m int; em int; ed int;
begin
  if (mo, dy) in ((1,1),(4,21),(5,1),(9,7),(10,12),(11,2),(11,15),(12,25)) then return true; end if;
  if y >= 2024 and mo = 11 and dy = 20 then return true; end if;
  a := y % 19; b := y / 100; c := y % 100; dd := b / 4; e := b % 4; f := (b + 8) / 25; g := (b - f + 1) / 3;
  h := (19*a + b - dd - g + 15) % 30; i := c / 4; k := c % 4; l := (32 + 2*e + 2*i - h - k) % 7; m := (a + 11*h + 22*l) / 451;
  em := (h + l - 7*m + 114) / 31; ed := ((h + l - 7*m + 114) % 31) + 1;
  return d = make_date(y, em, ed) - 2;
end $$;

create or replace function public.is_business_day(d date, p_user uuid default null)
returns boolean language sql stable as $$
  select extract(isodow from d) <= 5 and not public.is_national_holiday(d)
     and not exists (select 1 from public.holidays h where h.day = d and (p_user is null or h.user_id = p_user));
$$;

-- Primeiro momento permitido para enviar: dentro de 8h-17h em dia útil, senão 8h30 do próximo dia útil.
create or replace function public.next_send_time(p_due timestamptz, p_user uuid)
returns timestamptz language plpgsql stable as $$
declare loc timestamp := p_due at time zone 'America/Recife'; d date := loc::date; t time := loc::time;
begin
  if public.is_business_day(d, p_user) and t >= time '08:00' and t < time '17:00' then return p_due; end if;
  if public.is_business_day(d, p_user) and t < time '08:00' then return (d + time '08:30') at time zone 'America/Recife'; end if;
  d := d + 1;
  while not public.is_business_day(d, p_user) loop d := d + 1; end loop;
  return (d + time '08:30') at time zone 'America/Recife';
end $$;

create or replace function public.generate_pending_notifications(p_user uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  -- baixa os avisos de apólices que já saíram de "pendente"
  update notifications set read_at = now()
   where read_at is null and sale_id is not null and (p_user is null or user_id = p_user)
     and sale_id in (select id from sales where status <> 'pendente');

  -- apólices pendentes: primeiro aviso logo que cadastra; depois a cada 6 horas (o intervalo está na linha abaixo)
  for r in
    select s.id as sale_id, s.user_id, c.full_name, s.proposal_number
      from sales s join clients c on c.id = s.client_id left join notification_state st on st.sale_id = s.id
     where s.status = 'pendente' and (p_user is null or s.user_id = p_user)
       and public.next_send_time(case when st.last_at is null then s.created_at else st.last_at + interval '6 hours' end, s.user_id) <= now()
  loop
    insert into notifications (user_id, sale_id, message)
      values (r.user_id, r.sale_id, 'Apólice pendente: ' || r.full_name || coalesce(' · proposta ' || r.proposal_number, '') || '. Veja se já foi emitida.');
    insert into notification_state (sale_id, user_id, last_at) values (r.sale_id, r.user_id, now())
      on conflict (sale_id) do update set last_at = now();
    n := n + 1;
  end loop;

  -- agendamentos: aviso às 8h30 do dia marcado
  for r in
    select a.id, a.user_id, a.kind, a.title, a.starts_at, c.full_name
      from appointments a left join clients c on c.id = a.client_id
     where not a.done and a.notified_at is null and a.starts_at > now() - interval '12 hours'
       and (p_user is null or a.user_id = p_user)
       and public.next_send_time(((a.starts_at at time zone 'America/Recife')::date + time '08:30') at time zone 'America/Recife', a.user_id) <= now()
  loop
    insert into notifications (user_id, appointment_id, ref_date, message)
      values (r.user_id, r.id, (r.starts_at at time zone 'America/Recife')::date,
        initcap(r.kind) || ' às ' || to_char(r.starts_at at time zone 'America/Recife', 'HH24:MI') || ': ' || r.title || coalesce(' (' || r.full_name || ')', ''));
    update appointments set notified_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Agendamento no servidor: roda a cada 15 minutos (as regras de horário estão nas funções acima). Exige pg_cron.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('pending-policy-notifications', '*/15 * * * *', 'select public.generate_pending_notifications()');
exception when others then
  raise notice 'pg_cron indisponível (ative em Database > Extensions). O sistema também gera os avisos enquanto estiver aberto.';
end $$;
