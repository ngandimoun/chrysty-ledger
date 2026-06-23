import type { Asset, AssetDefinitionInput, WorkspaceProject } from "@/lib/assets/asset";
import { createAssetId, createEmptyAsset } from "@/lib/assets/asset";
import { assetV2ToArtifact } from "@/lib/assets/adapters/legacy";
import { validateAndNormalizeAsset } from "@/lib/assets/validation/gate";
import type { LedgerScope } from "@/lib/ledger/scope";
import { getWorkspaceRow } from "@/lib/ledger/workspaces";

export type AssetServiceError = {
  code: "VALIDATION" | "NOT_FOUND" | "DB";
  message: string;
  hints?: string[];
};

async function ensureWorkspaceAccessible(
  scope: LedgerScope,
  workspaceId: string
): Promise<boolean> {
  const row = await getWorkspaceRow(scope, workspaceId);
  if (row) return true;

  const { data, error } = await scope.supabase
    .from("ledger_workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    console.warn("[createAssetV2] workspace not found", {
      workspaceId,
      ledgerKey: scope.ledgerKey,
      userId: scope.userId,
    });
    return false;
  }
  return true;
}

async function assertWorkspace(
  scope: LedgerScope,
  workspaceId: string
): Promise<boolean> {
  return ensureWorkspaceAccessible(scope, workspaceId);
}

function assetFromRow(row: Record<string, unknown>): Asset {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    projectId: row.project_id ? String(row.project_id) : null,
    kind: String(row.kind),
    subtype: row.subtype ? String(row.subtype) : null,
    title: String(row.title),
    schema: (row.asset_schema as Record<string, unknown>) ?? (row.payload as Record<string, unknown>) ?? {},
    data: (row.asset_data as Record<string, unknown>) ?? {},
    relations: (row.relations as Asset["relations"]) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    version: Number(row.version ?? 1),
    creationSequence: Number(row.creation_sequence ?? 1),
    sourceMessageId: row.source_message_id ? String(row.source_message_id) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    archivedAt: row.archived_at ? String(row.archived_at) : null,
  };
}

function assetToRow(asset: Asset) {
  const legacyPayload = assetV2ToArtifact(asset);
  return {
    id: asset.id,
    workspace_id: asset.workspaceId,
    project_id: asset.projectId,
    title: asset.title,
    category:
      asset.kind === "table"
        ? "sheet"
        : asset.kind === "document"
          ? "report"
          : asset.kind === "file"
            ? "files"
            : asset.kind,
    kind: asset.kind,
    subtype: asset.subtype,
    payload: legacyPayload as import("@/lib/supabase/database.types").Json,
    asset_schema: asset.schema as import("@/lib/supabase/database.types").Json,
    asset_data: asset.data as import("@/lib/supabase/database.types").Json,
    relations: asset.relations as unknown as import("@/lib/supabase/database.types").Json,
    metadata: asset.metadata as import("@/lib/supabase/database.types").Json,
    source_message_id: asset.sourceMessageId ?? null,
    creation_sequence: asset.creationSequence,
    version: asset.version,
    created_at: asset.createdAt,
    updated_at: asset.updatedAt,
    archived_at: asset.archivedAt,
  };
}

export async function listAssetsV2(scope: LedgerScope, workspaceId: string): Promise<Asset[]> {
  const exists = await assertWorkspace(scope, workspaceId);
  if (!exists) return [];
  const { data, error } = await scope.supabase
    .from("ledger_assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("creation_sequence", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => assetFromRow(row as Record<string, unknown>));
}

export async function getAssetV2(
  scope: LedgerScope,
  workspaceId: string,
  assetId: string
): Promise<Asset | null> {
  const { data, error } = await scope.supabase
    .from("ledger_assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return assetFromRow(data as Record<string, unknown>);
}

export async function createAssetV2(
  scope: LedgerScope,
  input: AssetDefinitionInput
): Promise<{ asset: Asset } | { error: AssetServiceError }> {
  const exists = await assertWorkspace(scope, input.workspaceId);
  if (!exists) {
    return { error: { code: "NOT_FOUND", message: "Workspace not found" } };
  }
  const validated = validateAndNormalizeAsset(input);
  if (!validated.ok) {
    return {
      error: {
        code: "VALIDATION",
        message: validated.errors.join("; "),
        hints: validated.hints,
      },
    };
  }

  const asset = validated.asset;
  const { error } = await scope.supabase.from("ledger_assets").upsert(assetToRow(asset), {
    onConflict: "workspace_id,id",
  });
  if (error) {
    return { error: { code: "DB", message: error.message } };
  }
  return { asset };
}

export async function updateAssetV2(
  scope: LedgerScope,
  workspaceId: string,
  assetId: string,
  patch: Partial<Pick<Asset, "title" | "schema" | "data" | "metadata" | "subtype" | "relations">>
): Promise<{ asset: Asset } | { error: AssetServiceError }> {
  const existing = await getAssetV2(scope, workspaceId, assetId);
  if (!existing) {
    return { error: { code: "NOT_FOUND", message: "Asset not found" } };
  }

  const validated = validateAndNormalizeAsset({
    ...existing,
    title: patch.title ?? existing.title,
    schema: patch.schema ?? existing.schema,
    data: patch.data ?? existing.data,
    metadata: patch.metadata ?? existing.metadata,
    subtype: patch.subtype ?? existing.subtype,
    relations: patch.relations ?? existing.relations,
  });

  if (!validated.ok) {
    return {
      error: {
        code: "VALIDATION",
        message: validated.errors.join("; "),
        hints: validated.hints,
      },
    };
  }

  const asset: Asset = {
    ...validated.asset,
    id: assetId,
    version: existing.version + 1,
    updatedAt: new Date().toISOString(),
  };

  const { error } = await scope.supabase.from("ledger_assets").upsert(assetToRow(asset), {
    onConflict: "workspace_id,id",
  });
  if (error) return { error: { code: "DB", message: error.message } };
  return { asset };
}

export async function archiveAssetV2(
  scope: LedgerScope,
  workspaceId: string,
  assetId: string
): Promise<boolean> {
  const { error } = await scope.supabase
    .from("ledger_assets")
    .update({ archived_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", assetId);
  if (error) throw error;
  return true;
}

export async function searchAssetsV2(
  scope: LedgerScope,
  workspaceId: string,
  query: string
): Promise<Asset[]> {
  const assets = await listAssetsV2(scope, workspaceId);
  const q = query.trim().toLowerCase();
  if (!q) return assets;
  return assets.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.kind.toLowerCase().includes(q) ||
      (a.subtype ?? "").toLowerCase().includes(q)
  );
}

export async function linkAssetsV2(
  scope: LedgerScope,
  workspaceId: string,
  fromAssetId: string,
  toAssetId: string,
  relation: string
): Promise<void> {
  const exists = await assertWorkspace(scope, workspaceId);
  if (!exists) return;
  const { error } = await scope.supabase.from("ledger_asset_links").insert({
    workspace_id: workspaceId,
    from_asset_id: fromAssetId,
    to_asset_id: toAssetId,
    relation,
  });
  if (error) throw error;

  const from = await getAssetV2(scope, workspaceId, fromAssetId);
  if (from) {
    const relations = [...from.relations, { targetAssetId: toAssetId, relation }];
    await updateAssetV2(scope, workspaceId, fromAssetId, { relations });
  }
}

export async function createProjectV2(
  scope: LedgerScope,
  workspaceId: string,
  title: string,
  metadata: Record<string, unknown> = {}
): Promise<WorkspaceProject> {
  const exists = await assertWorkspace(scope, workspaceId);
  if (!exists) {
    throw new Error("Workspace not found");
  }
  const now = new Date().toISOString();
  const id = createAssetId();
  const { data, error } = await scope.supabase
    .from("ledger_projects")
    .insert({
      id,
      workspace_id: workspaceId,
      title,
      metadata: metadata as import("@/lib/supabase/database.types").Json,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw error;
  return {
    id: String(data.id),
    workspaceId,
    title: String(data.title),
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  };
}

export async function listProjectsV2(
  scope: LedgerScope,
  workspaceId: string
): Promise<WorkspaceProject[]> {
  const { data, error } = await scope.supabase
    .from("ledger_projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    workspaceId,
    title: String(row.title),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export function createInMemoryAsset(input: AssetDefinitionInput): Asset {
  const validated = validateAndNormalizeAsset(input);
  if (!validated.ok) {
    throw new Error(validated.errors.join("; "));
  }
  return validated.asset;
}
