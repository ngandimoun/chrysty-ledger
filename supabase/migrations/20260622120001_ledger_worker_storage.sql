-- Ledger worker storage policies on shared worker-uploads bucket
-- Path pattern: worker-uploads/{auth.uid()}/ledger/{filename}

drop policy if exists ledger_uploads_select_own on storage.objects;
drop policy if exists ledger_uploads_insert_own on storage.objects;
drop policy if exists ledger_uploads_update_own on storage.objects;
drop policy if exists ledger_uploads_delete_own on storage.objects;

create policy ledger_uploads_select_own
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'worker-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'ledger'
  );

create policy ledger_uploads_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'worker-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'ledger'
  );

create policy ledger_uploads_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'worker-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'ledger'
  );

create policy ledger_uploads_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'worker-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'ledger'
  );
