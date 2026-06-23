export type WorkspaceCanvasState = {
  openAssetId: string | null;
  panelWidthPercent: number;
  isChatOpen: boolean;
};

export const DEFAULT_CANVAS_STATE: WorkspaceCanvasState = {
  openAssetId: null,
  panelWidthPercent: 58,
  isChatOpen: true,
};
