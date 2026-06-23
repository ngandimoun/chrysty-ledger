import {
  legacyAssetEventsStorageKey,
  legacyAssetsStorageKey,
  legacyCanvasStorageKey,
  legacyCollapsedStorageKey,
  legacyMessagesStorageKey,
  legacyWorkspacesStorageKey,
} from "@/lib/ledger/legacy-storage";
import { parseLegacyMessages } from "@/lib/workspace-messages";
import type { Workspace } from "@/lib/workspaces";
import type { ChatMessage } from "@/lib/chat-types";
import type { WorkspaceAsset } from "@/lib/asset-types";
import type { AssetEvent } from "@/lib/asset-event-types";
import type { WorkspaceCanvasState } from "@/lib/workspace-canvas";
import type { AssetCategory } from "@/lib/asset-types";

import { LEDGER_MIGRATED_FLAG } from "@/lib/ledger/identity";
import { upsertAsset } from "@/lib/ledger/assets";
import { insertAssetEvent } from "@/lib/ledger/events";
import { insertMessage } from "@/lib/ledger/messages";
import type { LedgerScope } from "@/lib/ledger/scope";
import {
  countWorkspacesForKey,
  updateCanvasState,
  updateWorkspaceSettings,
} from "@/lib/ledger/workspaces";

function loadLegacyWorkspaces(): Workspace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(legacyWorkspacesStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Workspace =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.createdAt === "string"
    );
  } catch {
    return [];
  }
}

function loadLegacyMessages(workspaceId: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  return parseLegacyMessages(
    localStorage.getItem(legacyMessagesStorageKey(workspaceId))
  );
}

function loadLegacyAssets(workspaceId: string): WorkspaceAsset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(legacyAssetsStorageKey(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkspaceAsset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLegacyEvents(workspaceId: string): AssetEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(legacyAssetEventsStorageKey(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AssetEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLegacyCanvas(workspaceId: string): WorkspaceCanvasState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(legacyCanvasStorageKey(workspaceId));
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceCanvasState;
  } catch {
    return null;
  }
}

function loadLegacyCollapsed(workspaceId: string): AssetCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(legacyCollapsedStorageKey(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AssetCategory[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function migrateLocalStorageIfNeeded(scope: LedgerScope): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(LEDGER_MIGRATED_FLAG) === "1") return;

  const existingCount = await countWorkspacesForKey(scope);
  if (existingCount > 0) {
    localStorage.setItem(LEDGER_MIGRATED_FLAG, "1");
    return;
  }

  const legacyWorkspaces = loadLegacyWorkspaces();
  if (legacyWorkspaces.length === 0) {
    localStorage.setItem(LEDGER_MIGRATED_FLAG, "1");
    return;
  }

  for (const legacy of legacyWorkspaces) {
    const { data, error } = await scope.supabase
      .from("ledger_workspaces")
      .insert({
        id: legacy.id,
        name: legacy.name,
        ledger_key: scope.ledgerKey,
        user_id: scope.userId,
        created_at: legacy.createdAt,
        updated_at: legacy.createdAt,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") continue;
      throw error;
    }

    const workspaceId = data.id;
    const collapsed = loadLegacyCollapsed(workspaceId);
    if (collapsed.length > 0) {
      await updateWorkspaceSettings(scope, workspaceId, { collapsedCategories: collapsed });
    }

    const canvas = loadLegacyCanvas(workspaceId);
    if (canvas) {
      await updateCanvasState(scope, workspaceId, canvas);
    }

    const messages = loadLegacyMessages(workspaceId);
    for (const message of messages) {
      await insertMessage(scope, workspaceId, message);
    }

    const assets = loadLegacyAssets(workspaceId);
    for (const asset of assets) {
      await upsertAsset(scope, { ...asset, workspaceId });
    }

    const events = loadLegacyEvents(workspaceId);
    for (const event of events) {
      await insertAssetEvent(scope, { ...event, workspaceId });
    }
  }

  localStorage.setItem(LEDGER_MIGRATED_FLAG, "1");
}
