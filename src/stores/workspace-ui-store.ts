import { create } from "zustand";

type WorkspaceUiSlice = {
  activeAssetId: string | null;
  chatPanelOpen: boolean;
  selectedRowIds: string[];
};

type WorkspaceUiState = {
  byWorkspace: Record<string, WorkspaceUiSlice>;
  getSlice: (workspaceId: string) => WorkspaceUiSlice;
  setActiveAssetId: (workspaceId: string, assetId: string | null) => void;
  setChatPanelOpen: (workspaceId: string, open: boolean) => void;
  toggleChatPanel: (workspaceId: string) => void;
  setSelectedRowIds: (workspaceId: string, rowIds: string[]) => void;
  hydrateCanvas: (
    workspaceId: string,
    state: Pick<WorkspaceUiSlice, "activeAssetId" | "chatPanelOpen">
  ) => void;
};

const DEFAULT_SLICE: WorkspaceUiSlice = {
  activeAssetId: null,
  chatPanelOpen: true,
  selectedRowIds: [],
};

export const useWorkspaceUiStore = create<WorkspaceUiState>((set, get) => ({
  byWorkspace: {},

  getSlice: (workspaceId) => get().byWorkspace[workspaceId] ?? DEFAULT_SLICE,

  setActiveAssetId: (workspaceId, assetId) =>
    set((state) => ({
      byWorkspace: {
        ...state.byWorkspace,
        [workspaceId]: {
          ...(state.byWorkspace[workspaceId] ?? DEFAULT_SLICE),
          activeAssetId: assetId,
        },
      },
    })),

  setChatPanelOpen: (workspaceId, open) =>
    set((state) => ({
      byWorkspace: {
        ...state.byWorkspace,
        [workspaceId]: {
          ...(state.byWorkspace[workspaceId] ?? DEFAULT_SLICE),
          chatPanelOpen: open,
        },
      },
    })),

  toggleChatPanel: (workspaceId) => {
    const current = get().getSlice(workspaceId);
    get().setChatPanelOpen(workspaceId, !current.chatPanelOpen);
  },

  setSelectedRowIds: (workspaceId, rowIds) =>
    set((state) => ({
      byWorkspace: {
        ...state.byWorkspace,
        [workspaceId]: {
          ...(state.byWorkspace[workspaceId] ?? DEFAULT_SLICE),
          selectedRowIds: rowIds,
        },
      },
    })),

  hydrateCanvas: (workspaceId, canvas) =>
    set((state) => ({
      byWorkspace: {
        ...state.byWorkspace,
        [workspaceId]: {
          ...(state.byWorkspace[workspaceId] ?? DEFAULT_SLICE),
          activeAssetId: canvas.activeAssetId,
          chatPanelOpen: canvas.chatPanelOpen,
        },
      },
    })),
}));
