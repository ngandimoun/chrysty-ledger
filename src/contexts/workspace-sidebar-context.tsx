"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { GroupedAssets, WorkspaceAsset } from "@/lib/asset-types";

export type WorkspaceSidebarExplorerState = {
  workspaceId: string;
  groupedAssets: GroupedAssets[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
  onAddAssetToChat?: (asset: WorkspaceAsset) => void;
};

type WorkspaceSidebarContextValue = {
  explorerState: WorkspaceSidebarExplorerState | null;
  setExplorerState: (state: WorkspaceSidebarExplorerState) => void;
  clearExplorerState: () => void;
};

const WorkspaceSidebarContext = createContext<WorkspaceSidebarContextValue | null>(null);

function explorerStateEquals(
  prev: WorkspaceSidebarExplorerState | null,
  next: WorkspaceSidebarExplorerState
): boolean {
  if (!prev) return false;
  return (
    prev.workspaceId === next.workspaceId &&
    prev.searchQuery === next.searchQuery &&
    prev.activeAssetId === next.activeAssetId &&
    prev.groupedAssets === next.groupedAssets &&
    prev.onSearchChange === next.onSearchChange &&
    prev.onSelectAsset === next.onSelectAsset &&
    prev.onAddAssetToChat === next.onAddAssetToChat
  );
}

export function WorkspaceSidebarProvider({ children }: { children: ReactNode }) {
  const [explorerState, setExplorerStateInternal] =
    useState<WorkspaceSidebarExplorerState | null>(null);

  const setExplorerState = useCallback((state: WorkspaceSidebarExplorerState) => {
    setExplorerStateInternal((prev) =>
      explorerStateEquals(prev, state) ? prev : state
    );
  }, []);

  const clearExplorerState = useCallback(() => {
    setExplorerStateInternal(null);
  }, []);

  const value = useMemo(
    () => ({
      explorerState,
      setExplorerState,
      clearExplorerState,
    }),
    [explorerState, setExplorerState, clearExplorerState]
  );

  return (
    <WorkspaceSidebarContext.Provider value={value}>
      {children}
    </WorkspaceSidebarContext.Provider>
  );
}

export function useWorkspaceSidebar() {
  const context = useContext(WorkspaceSidebarContext);
  if (!context) {
    throw new Error("useWorkspaceSidebar must be used within WorkspaceSidebarProvider");
  }
  return context;
}
