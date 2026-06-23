import type { AssetCategory, WorkspaceAsset } from "@/lib/asset-types";
import type { AssetEvent, AssetEventType } from "@/lib/asset-event-types";
import type { ChatMessage } from "@/lib/chat-types";
import {
  ledgerRowToWorkspaceAsset,
  workspaceAssetToAssetV2,
} from "@/lib/assets/adapters/legacy";
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import type { Workspace } from "@/lib/workspaces";
import type { WorkspaceCanvasState } from "@/lib/workspace-canvas";

export type LedgerWorkspaceRow = Tables<"ledger_workspaces">;
export type LedgerWorkspaceSettings = {
  collapsedCategories?: AssetCategory[];
};

const DEFAULT_CANVAS: WorkspaceCanvasState = {
  openAssetId: null,
  panelWidthPercent: 58,
  isChatOpen: true,
};

export function workspaceFromRow(row: LedgerWorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function canvasFromRow(row: LedgerWorkspaceRow): WorkspaceCanvasState {
  const raw = row.canvas_state as Partial<WorkspaceCanvasState> | null;
  if (!raw || typeof raw !== "object") return DEFAULT_CANVAS;

  return {
    openAssetId: typeof raw.openAssetId === "string" ? raw.openAssetId : null,
    panelWidthPercent:
      typeof raw.panelWidthPercent === "number"
        ? raw.panelWidthPercent
        : DEFAULT_CANVAS.panelWidthPercent,
    isChatOpen:
      typeof raw.isChatOpen === "boolean" ? raw.isChatOpen : DEFAULT_CANVAS.isChatOpen,
  };
}

export function settingsFromRow(row: LedgerWorkspaceRow): LedgerWorkspaceSettings {
  const raw = row.settings as LedgerWorkspaceSettings | null;
  if (!raw || typeof raw !== "object") return {};
  return raw;
}

export function messageFromRow(row: Tables<"ledger_messages">): ChatMessage {
  return row.payload as ChatMessage;
}

export function assetFromRow(row: Tables<"ledger_assets">): WorkspaceAsset {
  return ledgerRowToWorkspaceAsset(row);
}

export function eventFromRow(row: Tables<"ledger_asset_events">): AssetEvent {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    sequence: row.sequence,
    type: row.type as AssetEventType,
    occurredAt: row.occurred_at,
    assetId: typeof payload.assetId === "string" ? payload.assetId : undefined,
    version: typeof payload.version === "number" ? payload.version : undefined,
    title: typeof payload.title === "string" ? payload.title : undefined,
    payload: payload.payload as AssetEvent["payload"],
    files: payload.files as AssetEvent["files"],
    sourceMessageId:
      typeof payload.sourceMessageId === "string"
        ? payload.sourceMessageId
        : undefined,
  };
}

export function assetToRow(asset: WorkspaceAsset): TablesInsert<"ledger_assets"> {
  const v2 = workspaceAssetToAssetV2(asset);
  return {
    id: asset.id,
    workspace_id: asset.workspaceId,
    title: asset.title,
    category: asset.category,
    kind: asset.kind,
    subtype: v2.subtype ?? null,
    payload: asset.payload as TablesInsert<"ledger_assets">["payload"],
    asset_schema: v2.schema as TablesInsert<"ledger_assets">["asset_schema"],
    asset_data: v2.data as TablesInsert<"ledger_assets">["asset_data"],
    relations: v2.relations as TablesInsert<"ledger_assets">["relations"],
    metadata: v2.metadata as TablesInsert<"ledger_assets">["metadata"],
    source_message_id: asset.sourceMessageId ?? null,
    creation_sequence: asset.creationSequence,
    version: asset.version,
    created_at: asset.createdAt,
    updated_at: asset.updatedAt,
  };
}

export function eventToRow(
  event: AssetEvent
): TablesInsert<"ledger_asset_events"> {
  return {
    id: event.id,
    workspace_id: event.workspaceId,
    sequence: event.sequence,
    type: event.type,
    occurred_at: event.occurredAt,
    payload: {
      assetId: event.assetId,
      version: event.version,
      title: event.title,
      payload: event.payload,
      files: event.files,
      sourceMessageId: event.sourceMessageId,
    },
  };
}
