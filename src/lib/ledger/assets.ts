import type { WorkspaceAsset } from "@/lib/asset-types";

import { assetFromRow, assetToRow } from "@/lib/ledger/mappers";
import { getWorkspaceRow } from "@/lib/ledger/workspaces";
import type { LedgerScope } from "@/lib/ledger/scope";

async function assertWorkspaceAccess(
  scope: LedgerScope,
  workspaceId: string
): Promise<void> {
  const row = await getWorkspaceRow(scope, workspaceId);
  if (!row) {
    throw new Error("Workspace not found");
  }
}

export async function listAssets(
  scope: LedgerScope,
  workspaceId: string
): Promise<WorkspaceAsset[]> {
  await assertWorkspaceAccess(scope, workspaceId);

  const { data, error } = await scope.supabase
    .from("ledger_assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("creation_sequence", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(assetFromRow);
}

export async function upsertAsset(
  scope: LedgerScope,
  asset: WorkspaceAsset
): Promise<void> {
  await assertWorkspaceAccess(scope, asset.workspaceId);

  const { error } = await scope.supabase
    .from("ledger_assets")
    .upsert(assetToRow(asset), { onConflict: "workspace_id,id" });

  if (error) throw error;
}
