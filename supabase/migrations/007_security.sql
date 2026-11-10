-- E-mail do corretor (cadastro, configurações e PDF).
alter table public.settings add column if not exists broker_email text;

-- Rate limiting por usuário, usado pelas funções de servidor (chat e e-mail).
-- Sem políticas de acesso: só as funções abaixo (security definer) mexem na tabela.
create table if not exists public.rate_limits (
  user_id uuid not null,
  key text not null,
  window_start timestamptz not null default now(),
  hits int not null default 0,
  primary key (user_id, key)
);
alter table public.rate_limits enable row level security;

-- Retorna true se o usuário ainda está dentro do limite (p_max chamadas a cada p_window_seconds).
create or replace function public.rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then return false; end if;
  insert into rate_limits as r (user_id, key, window_start, hits) values (uid, p_key, now(), 1)
  on conflict (user_id, key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into n;
  return n <= p_max;
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon;
grant execute on function public.rate_limit_hit(text, int, int) to authenticated;
