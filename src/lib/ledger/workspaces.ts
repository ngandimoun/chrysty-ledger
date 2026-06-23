import type { AssetCategory } from "@/lib/asset-types";
import { createWorkspaceRecord, type Workspace } from "@/lib/workspaces";
import type { WorkspaceCanvasState } from "@/lib/workspace-canvas";

import {
  canvasFromRow,
  settingsFromRow,
  workspaceFromRow,
  type LedgerWorkspaceSettings,
} from "@/lib/ledger/mappers";
import { workspaceScopeFilter, type LedgerScope } from "@/lib/ledger/scope";

export async function listWorkspaces(scope: LedgerScope): Promise<Workspace[]> {
  const { data, error } = await scope.supabase
    .from("ledger_workspaces")
    .select("*")
    .or(workspaceScopeFilter(scope))
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(workspaceFromRow);
}

export async function getWorkspaceRow(scope: LedgerScope, workspaceId: string) {
  const { data, error } = await scope.supabase
    .from("ledger_workspaces")
    .select("*")
    .eq("id", workspaceId)
    .or(workspaceScopeFilter(scope))
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createWorkspace(
  scope: LedgerScope,
  name: string
): Promise<Workspace> {
  const record = createWorkspaceRecord(name);

  const { data, error } = await scope.supabase
    .from("ledger_workspaces")
    .insert({
      id: record.id,
      name: record.name,
      ledger_key: scope.ledgerKey,
      user_id: scope.userId,
      created_at: record.createdAt,
      updated_at: record.createdAt,
    })
    .select("*")
    .single();

  if (error) throw error;
  return workspaceFromRow(data);
}

export async function updateCanvasState(
  scope: LedgerScope,
  workspaceId: string,
  canvasState: WorkspaceCanvasState
): Promise<void> {
  const { error } = await scope.supabase
    .from("ledger_workspaces")
    .update({ canvas_state: canvasState })
    .eq("id", workspaceId)
    .or(workspaceScopeFilter(scope));

  if (error) throw error;
}

export async function getCanvasState(
  scope: LedgerScope,
  workspaceId: string
): Promise<WorkspaceCanvasState> {
  const row = await getWorkspaceRow(scope, workspaceId);
  if (!row) {
    return { openAssetId: null, panelWidthPercent: 58, isChatOpen: true };
  }
  return canvasFromRow(row);
}

export async function getWorkspaceSettings(
  scope: LedgerScope,
  workspaceId: string
): Promise<LedgerWorkspaceSettings> {
  const row = await getWorkspaceRow(scope, workspaceId);
  if (!row) return {};
  return settingsFromRow(row);
}

export async function updateWorkspaceSettings(
  scope: LedgerScope,
  workspaceId: string,
  settings: LedgerWorkspaceSettings
): Promise<void> {
  const { error } = await scope.supabase
    .from("ledger_workspaces")
    .update({ settings })
    .eq("id", workspaceId)
    .or(workspaceScopeFilter(scope));

  if (error) throw error;
}

export async function updateCollapsedCategories(
  scope: LedgerScope,
  workspaceId: string,
  collapsedCategories: AssetCategory[]
): Promise<void> {
  const current = await getWorkspaceSettings(scope, workspaceId);
  await updateWorkspaceSettings(scope, workspaceId, {
    ...current,
    collapsedCategories,
  });
}

export async function claimLedgerWorkspaces(
  scope: LedgerScope,
  userId: string
): Promise<void> {
  const { error } = await scope.supabase
    .from("ledger_workspaces")
    .update({ user_id: userId })
    .eq("ledger_key", scope.ledgerKey)
    .is("user_id", null);

  if (error) throw error;
}

export async function countWorkspacesForKey(scope: LedgerScope): Promise<number> {
  const { count, error } = await scope.supabase
    .from("ledger_workspaces")
    .select("*", { count: "exact", head: true })
    .eq("ledger_key", scope.ledgerKey);

  if (error) throw error;
  return count ?? 0;
}
