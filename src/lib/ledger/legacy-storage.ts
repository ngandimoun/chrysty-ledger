const WORKSPACES_STORAGE_KEY = "chrysty-workspaces";

export function legacyWorkspacesStorageKey(): string {
  return WORKSPACES_STORAGE_KEY;
}

export function legacyMessagesStorageKey(workspaceId: string): string {
  return `chrysty-workspace-messages:${workspaceId}`;
}

export function legacyAssetsStorageKey(workspaceId: string): string {
  return `chrysty-workspace-assets:${workspaceId}`;
}

export function legacyAssetEventsStorageKey(workspaceId: string): string {
  return `chrysty-workspace-asset-events:${workspaceId}`;
}

export function legacyAssetSequenceStorageKey(workspaceId: string): string {
  return `chrysty-workspace-asset-seq:${workspaceId}`;
}

export function legacyCanvasStorageKey(workspaceId: string): string {
  return `chrysty-workspace-canvas:${workspaceId}`;
}

export function legacyCollapsedStorageKey(workspaceId: string): string {
  return `chrysty-assets-collapsed:${workspaceId}`;
}
