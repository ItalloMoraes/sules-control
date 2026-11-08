-- Propostas em PDF: espaço privado no Storage, uma pasta por usuário.
alter table public.sales add column if not exists proposal_pdf_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proposals', 'proposals', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy proposals_select on storage.objects for select to authenticated
  using (bucket_id = 'proposals' and (storage.foldername(name))[1] = auth.uid()::text);
create policy proposals_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'proposals' and (storage.foldername(name))[1] = auth.uid()::text);
create policy proposals_update on storage.objects for update to authenticated
  using (bucket_id = 'proposals' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'proposals' and (storage.foldername(name))[1] = auth.uid()::text);
create policy proposals_delete on storage.objects for delete to authenticated
  using (bucket_id = 'proposals' and (storage.foldername(name))[1] = auth.uid()::text);
