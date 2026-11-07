-- Execute UMA vez, logado como o único usuário (SQL Editor > "Run as" ou via função abaixo).
-- Cria perfil, configurações, seguradora padrão e produtos iniciais para o usuário atual.
create or replace function public.bootstrap_account(p_name text default 'Corretor')
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ins uuid;
begin
  if uid is null then raise exception 'Faça login antes de inicializar a conta.'; end if;
  insert into profiles(id, full_name) values (uid, p_name) on conflict do nothing;
  insert into insurers(user_id, name, is_default) values (uid, 'Suhai Seguradora', true)
    on conflict (user_id, name) do nothing;
  select id into ins from insurers where user_id = uid and name = 'Suhai Seguradora';
  insert into settings(user_id, broker_name, default_insurer_id) values (uid, p_name, ins)
    on conflict (user_id) do nothing;
  insert into products(user_id, name) values (uid,'Seguro Moto'),(uid,'Seguro Auto'),(uid,'Digital')
    on conflict (user_id, name) do nothing;
end $$;
grant execute on function public.bootstrap_account(text) to authenticated;
