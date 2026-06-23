import type { AssetEvent } from "@/lib/asset-event-types";

import { eventFromRow, eventToRow } from "@/lib/ledger/mappers";
import { getWorkspaceRow } from "@/lib/ledger/workspaces";
import type { LedgerScope } from "@/lib/ledger/scope";

const MAX_EVENT_INSERT_ATTEMPTS = 3;

async function assertWorkspaceAccess(
  scope: LedgerScope,
  workspaceId: string
): Promise<void> {
  const row = await getWorkspaceRow(scope, workspaceId);
  if (!row) {
    throw new Error("Workspace not found");
  }
}

function isDuplicateSequenceError(error: { code?: string }): boolean {
  return error.code === "23505";
}

export async function nextAssetSequence(
  scope: LedgerScope,
  workspaceId: string
): Promise<number> {
  await assertWorkspaceAccess(scope, workspaceId);

  const { data, error } = await scope.supabase
    .from("ledger_asset_events")
    .select("sequence")
    .eq("workspace_id", workspaceId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.sequence ?? 0) + 1;
}

export async function nextCreationSequence(
  scope: LedgerScope,
  workspaceId: string
): Promise<number> {
  await assertWorkspaceAccess(scope, workspaceId);

  const { data, error } = await scope.supabase
    .from("ledger_assets")
    .select("creation_sequence")
    .eq("workspace_id", workspaceId)
    .order("creation_sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.creation_sequence ?? 0) + 1;
}

export async function insertAssetEvent(
  scope: LedgerScope,
  event: AssetEvent
): Promise<void> {
  await assertWorkspaceAccess(scope, event.workspaceId);

  let lastError: { code?: string; message: string } | null = null;

  for (let attempt = 0; attempt < MAX_EVENT_INSERT_ATTEMPTS; attempt++) {
    const sequence =
      attempt === 0
        ? event.sequence
        : await nextAssetSequence(scope, event.workspaceId);

    const { error } = await scope.supabase
      .from("ledger_asset_events")
      .insert(eventToRow({ ...event, sequence }));

    if (!error) {
      return;
    }

    if (!isDuplicateSequenceError(error)) {
      throw error;
    }

    lastError = error;
  }

  throw lastError ?? new Error("Failed to insert asset event");
}

export async function listAssetEvents(
  scope: LedgerScope,
  workspaceId: string
): Promise<AssetEvent[]> {
  await assertWorkspaceAccess(scope, workspaceId);

  const { data, error } = await scope.supabase
    .from("ledger_asset_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("sequence", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(eventFromRow);
}
