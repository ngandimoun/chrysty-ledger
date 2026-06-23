-- Asset V2: projects, links, schema/data columns, archival

create table if not exists ledger_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references ledger_workspaces(id) on delete cascade,
  title text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ledger_projects_workspace_id_idx
  on ledger_projects(workspace_id);

alter table ledger_assets
  add column if not exists project_id uuid references ledger_projects(id) on delete set null,
  add column if not exists subtype text,
  add column if not exists asset_schema jsonb not null default '{}',
  add column if not exists asset_data jsonb not null default '{}',
  add column if not exists relations jsonb not null default '[]',
  add column if not exists metadata jsonb not null default '{}',
  add column if not exists archived_at timestamptz;

create table if not exists ledger_asset_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references ledger_workspaces(id) on delete cascade,
  from_asset_id text not null,
  to_asset_id text not null,
  relation text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, from_asset_id, to_asset_id, relation)
);

create index if not exists ledger_asset_links_workspace_idx
  on ledger_asset_links(workspace_id, from_asset_id);

alter table ledger_asset_events drop constraint if exists ledger_asset_events_type_check;

alter table ledger_asset_events add constraint ledger_asset_events_type_check
  check (type in (
    'asset_created',
    'asset_updated',
    'files_uploaded',
    'asset_archived',
    'asset_linked',
    'asset_transformed',
    'project_created'
  ));

create trigger ledger_projects_set_updated_at
  before update on ledger_projects
  for each row execute function public.set_updated_at();

alter table ledger_projects enable row level security;
alter table ledger_asset_links enable row level security;

create policy ledger_projects_select_own on ledger_projects
  for select using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_projects.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_projects_insert_own on ledger_projects
  for insert with check (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_projects.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_projects_update_own on ledger_projects
  for update using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_projects.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_projects_delete_own on ledger_projects
  for delete using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_projects.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_asset_links_select_own on ledger_asset_links
  for select using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_asset_links.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_asset_links_insert_own on ledger_asset_links
  for insert with check (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_asset_links.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy ledger_asset_links_delete_own on ledger_asset_links
  for delete using (
    exists (
      select 1 from ledger_workspaces w
      where w.id = ledger_asset_links.workspace_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );
