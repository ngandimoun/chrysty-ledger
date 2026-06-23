-- Ledger worker schema for chrysty.dev (isolated from other workers)
-- Chrysty AI Ledger: small business accounting, powered by AI

create extension if not exists "pgcrypto";

insert into public.workers (slug, name, status)
values ('ledger', 'Chrysty AI Ledger', 'active')
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status;

create table if not exists ledger_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  platform_workspace_id uuid references worker_workspaces(id) on delete set null,
  name text not null,
  visitor_token text not null default ('vis_' || replace(gen_random_uuid()::text, '-', '')),
  ledger_key text,
  canvas_state jsonb not null default '{}',
  settings jsonb not null default '{}',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ledger_workspaces_visitor_token_unique
  on ledger_workspaces(visitor_token);

create index if not exists ledger_workspaces_user_id_idx
  on ledger_workspaces(user_id);

create index if not exists ledger_workspaces_ledger_key_idx
  on ledger_workspaces(ledger_key);

create unique index if not exists ledger_workspaces_user_default_unique
  on ledger_workspaces(user_id) where is_default = true and user_id is not null;

create table if not exists ledger_messages (
  id text primary key,
  workspace_id uuid not null references ledger_workspaces(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ledger_messages_workspace_id_idx
  on ledger_messages(workspace_id, created_at);

create table if not exists ledger_assets (
  id text not null,
  workspace_id uuid not null references ledger_workspaces(id) on delete cascade,
  title text not null,
  category text not null check (
    category in ('sheet', 'dashboard', 'chart', 'report', 'invoice', 'export')
  ),
  kind text not null,
  payload jsonb not null,
  source_message_id text,
  creation_sequence integer not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create index if not exists ledger_assets_workspace_sequence_idx
  on ledger_assets(workspace_id, creation_sequence desc);

create index if not exists ledger_assets_workspace_updated_idx
  on ledger_assets(workspace_id, updated_at desc);

create table if not exists ledger_asset_events (
  id text primary key,
  workspace_id uuid not null references ledger_workspaces(id) on delete cascade,
  sequence integer not null,
  type text not null check (type in ('asset_created', 'asset_updated', 'files_uploaded')),
  occurred_at timestamptz not null,
  payload jsonb not null default '{}',
  unique (workspace_id, sequence)
);

create index if not exists ledger_asset_events_workspace_sequence_idx
  on ledger_asset_events(workspace_id, sequence);

create trigger ledger_workspaces_set_updated_at
  before update on ledger_workspaces
  for each row execute function public.set_updated_at();

create trigger ledger_assets_set_updated_at
  before update on ledger_assets
  for each row execute function public.set_updated_at();

alter table ledger_workspaces enable row level security;
alter table ledger_messages enable row level security;
alter table ledger_assets enable row level security;
alter table ledger_asset_events enable row level security;

create policy ledger_workspaces_select_own on ledger_workspaces
  for select using (user_id is null or user_id = auth.uid());

create policy ledger_workspaces_insert_own on ledger_workspaces
  for insert with check (user_id is null or user_id = auth.uid());

create policy ledger_workspaces_update_own on ledger_workspaces
  for update using (user_id is null or user_id = auth.uid());

create policy ledger_workspaces_delete_own on ledger_workspaces
  for delete using (user_id is null or user_id = auth.uid());

create policy ledger_messages_select_own on ledger_messages
  for select using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_messages.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_messages_insert_own on ledger_messages
  for insert with check (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_messages.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_messages_update_own on ledger_messages
  for update using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_messages.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_messages_delete_own on ledger_messages
  for delete using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_messages.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_assets_select_own on ledger_assets
  for select using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_assets.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_assets_insert_own on ledger_assets
  for insert with check (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_assets.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_assets_update_own on ledger_assets
  for update using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_assets.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_assets_delete_own on ledger_assets
  for delete using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_assets.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_asset_events_select_own on ledger_asset_events
  for select using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_asset_events.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_asset_events_insert_own on ledger_asset_events
  for insert with check (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_asset_events.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_asset_events_update_own on ledger_asset_events
  for update using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_asset_events.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_asset_events_delete_own on ledger_asset_events
  for delete using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_asset_events.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );
