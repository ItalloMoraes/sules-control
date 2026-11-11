-- Endereço do cliente, preenchido pelo CEP (consulta ViaCEP no navegador).
alter table public.clients
  add column if not exists cep text, add column if not exists street text, add column if not exists neighborhood text,
  add column if not exists city text, add column if not exists state text;
