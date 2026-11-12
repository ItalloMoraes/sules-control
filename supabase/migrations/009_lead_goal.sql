-- Meta de conversão de leads (%), editável no painel Desempenho.
alter table public.settings add column if not exists lead_conversion_goal numeric(5,2) not null default 10;
