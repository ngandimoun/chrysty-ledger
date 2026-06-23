-- Dedicated bucket for Chrysty AI Ledger file assets
-- Path pattern: {ledgerKey}/{workspaceId}/{assetId}/{filename}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ledger-uploads',
  'ledger-uploads',
  false,
  104857600,
  array[
    'application/pdf',
    'text/csv',
    'application/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
    'text/html',
    'application/json',
    'application/xml',
    'text/xml',
    'application/rtf',
    'text/rtf',
    'application/yaml',
    'text/yaml'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ledger_uploads_bucket_select on storage.objects;
drop policy if exists ledger_uploads_bucket_insert on storage.objects;
drop policy if exists ledger_uploads_bucket_update on storage.objects;
drop policy if exists ledger_uploads_bucket_delete on storage.objects;

create policy ledger_uploads_bucket_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'ledger-uploads');

create policy ledger_uploads_bucket_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ledger-uploads');

create policy ledger_uploads_bucket_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'ledger-uploads');

create policy ledger_uploads_bucket_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'ledger-uploads');
