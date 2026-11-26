-- Origens da venda editáveis (antes só "Digital Suhai" e "Venda própria").
create table public.origins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null,                       -- identificador estável usado nas vendas (não muda ao renomear)
  name text not null,
  is_default boolean not null default false, -- as duas originais não podem ser apagadas (a conferência mensal usa a Digital Suhai)
  created_at timestamptz not null default now(),
  unique (user_id, code)
);
alter table public.origins enable row level security;
create policy origins_sel on public.origins for select using (user_id = auth.uid());
create policy origins_ins on public.origins for insert with check (user_id = auth.uid());
create policy origins_upd on public.origins for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy origins_del on public.origins for delete using (user_id = auth.uid());

-- origens originais para quem já usa o sistema (contas novas recebem pelo próprio site)
insert into public.origins (user_id, code, name, is_default)
  select u.id, v.code, v.name, true from auth.users u cross join (values ('digital_suhai', 'Digital Suhai'), ('venda_propria', 'Venda própria')) as v(code, name)
  on conflict (user_id, code) do nothing;

-- a venda deixa de aceitar só os dois valores antigos
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.sales'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%origin%'
  loop execute format('alter table public.sales drop constraint %I', c); end loop;
end $$;
