-- Excluir uma venda de verdade (sem virar cancelamento). Leva junto cancelamentos, estornos e recebimentos dela.
drop trigger if exists sales_prevent_delete_trg on public.sales;
drop trigger if exists receipts_prevent_delete_trg on public.commission_receipts;
drop trigger if exists cancellations_no_delete on public.cancellations;
drop trigger if exists reversals_no_delete on public.reversal_transactions;

do $$
declare r record;
begin
  for r in select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def
             from pg_constraint
            where confrelid = 'public.sales'::regclass and contype = 'f' and confdeltype in ('r', 'a')
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s on delete cascade', r.tbl, r.conname,
                   regexp_replace(r.def, ' ON DELETE (RESTRICT|NO ACTION)', '', 'i'));
  end loop;
end $$;
