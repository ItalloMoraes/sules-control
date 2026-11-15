-- Registro dos e-mails enviados ao RH, para você ver no sistema se cada venda foi enviada (ou se falhou).
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  to_addr text,
  status text not null check (status in ('enviado', 'erro')),
  error text,
  created_at timestamptz not null default now()
);
create index email_log_sale_idx on public.email_log (sale_id, created_at desc);
alter table public.email_log enable row level security;
create policy email_log_sel on public.email_log for select using (user_id = auth.uid());
create policy email_log_ins on public.email_log for insert with check (user_id = auth.uid());
create policy email_log_del on public.email_log for delete using (user_id = auth.uid());
