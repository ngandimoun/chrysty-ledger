"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useOptionalLedgerScope } from "@/contexts/ledger-context";
import type { WorkspaceAsset } from "@/lib/asset-types";
import { getCanvasState, updateCanvasState } from "@/lib/ledger/workspaces";
import { useWorkspaceUiStore } from "@/stores/workspace-ui-store";
import type { WorkspaceCanvasState } from "@/lib/workspace-canvas";

const DEFAULT_CANVAS_STATE: WorkspaceCanvasState = {
  openAssetId: null,
  panelWidthPercent: 58,
  isChatOpen: true,
};

export function useWorkspaceCanvas(
  workspaceId: string,
  getAssetById: (assetId: string) => WorkspaceAsset | undefined
) {
  const scope = useOptionalLedgerScope();
  const uiSlice = useWorkspaceUiStore((state) => state.getSlice(workspaceId));
  const hydrateCanvas = useWorkspaceUiStore((state) => state.hydrateCanvas);
  const setActiveAssetId = useWorkspaceUiStore((state) => state.setActiveAssetId);
  const setChatPanelOpen = useWorkspaceUiStore((state) => state.setChatPanelOpen);
  const [panelWidthPercent, setPanelWidthPercent] = useState(
    DEFAULT_CANVAS_STATE.panelWidthPercent
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!scope) return;
    const activeScope = scope;

    let cancelled = false;

    async function load() {
      try {
        const canvas = await getCanvasState(activeScope, workspaceId);
        if (!cancelled) {
          hydrateCanvas(workspaceId, {
            activeAssetId: canvas.openAssetId,
            chatPanelOpen: canvas.isChatOpen,
          });
          setPanelWidthPercent(canvas.panelWidthPercent);
          setIsHydrated(true);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load canvas state");
          setIsHydrated(true);
        }
      }
    }

    setIsHydrated(false);
    void load();

    return () => {
      cancelled = true;
    };
  }, [scope, workspaceId, hydrateCanvas]);

  useEffect(() => {
    if (!scope || !isHydrated) return;
    const activeScope = scope;

    const state: WorkspaceCanvasState = {
      openAssetId: uiSlice.activeAssetId,
      panelWidthPercent,
      isChatOpen: uiSlice.chatPanelOpen,
    };

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void updateCanvasState(activeScope, workspaceId, state).catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to save canvas state");
      });
    }, 300);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [scope, workspaceId, uiSlice.activeAssetId, uiSlice.chatPanelOpen, panelWidthPercent, isHydrated]);

  const activeAsset = uiSlice.activeAssetId
    ? getAssetById(uiSlice.activeAssetId)
    : undefined;

  const isAssetOpen = Boolean(uiSlice.activeAssetId && activeAsset);

  const openAsset = useCallback(
    (assetId: string) => {
      setActiveAssetId(workspaceId, assetId);
      setChatPanelOpen(workspaceId, true);
    },
    [workspaceId, setActiveAssetId, setChatPanelOpen]
  );

  const closeAsset = useCallback(() => {
    setActiveAssetId(workspaceId, null);
    setChatPanelOpen(workspaceId, true);
  }, [workspaceId, setActiveAssetId, setChatPanelOpen]);

  const showChat = useCallback(() => {
    setChatPanelOpen(workspaceId, true);
  }, [workspaceId, setChatPanelOpen]);

  const hideChat = useCallback(() => {
    setChatPanelOpen(workspaceId, false);
  }, [workspaceId, setChatPanelOpen]);

  const toggleChat = useCallback(() => {
    setChatPanelOpen(workspaceId, !uiSlice.chatPanelOpen);
  }, [workspaceId, uiSlice.chatPanelOpen, setChatPanelOpen]);

  const toggleAsset = useCallback(
    (assetId: string) => {
      if (uiSlice.activeAssetId === assetId) {
        setActiveAssetId(workspaceId, null);
        setChatPanelOpen(workspaceId, true);
        return;
      }
      setActiveAssetId(workspaceId, assetId);
      setChatPanelOpen(workspaceId, true);
    },
    [workspaceId, uiSlice.activeAssetId, setActiveAssetId, setChatPanelOpen]
  );

  return {
    isAssetOpen,
    isChatOpen: uiSlice.chatPanelOpen,
    openAssetId: uiSlice.activeAssetId,
    activeAsset,
    openAsset,
    closeAsset,
    showChat,
    hideChat,
    toggleChat,
    toggleAsset,
  };
}
