"use client";

import { useCallback, useEffect, useRef } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { AssetCanvas } from "@/components/workspace/asset-canvas";
import { Button } from "@/components/ui/button";
import { ConversationThread } from "@/components/workspace/conversation-thread";
import { WorkspaceOverview } from "@/components/workspace/workspace-overview";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { useChatAssetRefs } from "@/contexts/chat-asset-refs-context";
import { useLedger } from "@/contexts/ledger-context";
import { useWorkspaceSidebar } from "@/contexts/workspace-sidebar-context";
import { useWorkspaceAssets } from "@/hooks/use-workspace-assets";
import { useWorkspaceCanvas } from "@/hooks/use-workspace-canvas";
import { useWorkspaceChat } from "@/hooks/use-workspace-chat";
import { useIsMobile } from "@/hooks/use-mobile";
import { getArtifactsFromReplies } from "@/lib/chat-artifacts";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { WorkspaceAsset } from "@/lib/asset-types";
import type { ChatMessage, ChatSendOptions } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

type WorkspaceShellProps = {
  workspaceId: string;
  workspaceName: string;
};

export function WorkspaceShell({ workspaceId, workspaceName }: WorkspaceShellProps) {
  const isMobile = useIsMobile();
  const { ledgerKey, userId } = useLedger();
  const { setExplorerState, clearExplorerState } = useWorkspaceSidebar();
  const {
    chatAssetRefs,
    addChatAssetRef,
    removeChatAssetRef,
    clearChatAssetRefs,
    registerChatInputFocus,
  } = useChatAssetRefs();
  const registerArtifactsRef = useRef<
    ReturnType<typeof useWorkspaceAssets>["registerArtifacts"] | null
  >(null);

  const registerAssetsV2Ref = useRef<
    ReturnType<typeof useWorkspaceAssets>["registerAssetsV2"] | null
  >(null);
  const syncAssetV2ToCacheRef = useRef<
    ReturnType<typeof useWorkspaceAssets>["syncAssetV2ToCache"] | null
  >(null);
  const openAssetRef = useRef<ReturnType<typeof useWorkspaceCanvas>["openAsset"] | null>(null);
  const openAssetIdRef = useRef<string | null>(null);
  const openAssetSnapshotRef = useRef<WorkspaceAsset | null>(null);

  const handleReplies = useCallback(
    (replies: ChatMessage[], context: { streamedAssetIds: string[] }) => {
      const streamedIds = new Set(context.streamedAssetIds);
      const artifacts = getArtifactsFromReplies(replies).filter(
        (artifact) => !streamedIds.has(artifact.id)
      );

      if (artifacts.length > 0) {
        registerArtifactsRef.current?.(
          artifacts.map((artifact) => {
            const sourceMessage = replies.find(
              (reply) => reply.type === "artifact" && reply.artifact.id === artifact.id
            );
            return {
              artifact,
              sourceMessageId: sourceMessage?.id,
            };
          })
        );
      }
    },
    []
  );

  const handleAssetEvent = useCallback(
    (event: {
      type: "asset_created" | "asset_updated";
      asset: import("@/lib/assets/asset").Asset;
    }) => {
      syncAssetV2ToCacheRef.current?.(event.asset);
    },
    []
  );

  const { messages, isResponding, pendingAssistant, sendMessage, stopResponding } =
    useWorkspaceChat(workspaceId, {
      getOpenAssetId: () => openAssetIdRef.current,
      onReplies: handleReplies,
      onAssetEvent: handleAssetEvent,
      onMessageSent: clearChatAssetRefs,
    });

  const {
    assets,
    groupedAssets,
    searchQuery,
    setSearchQuery,
    registerArtifacts,
    registerAssetsV2,
    syncAssetV2ToCache,
    getAssetById,
    resolveAssetForOpen,
    ensureAssetInCache,
  } = useWorkspaceAssets(workspaceId, messages);

  registerArtifactsRef.current = registerArtifacts;
  registerAssetsV2Ref.current = registerAssetsV2;
  syncAssetV2ToCacheRef.current = syncAssetV2ToCache;

  const {
    isChatOpen,
    openAssetId,
    activeAsset,
    openAsset,
    closeAsset,
    showChat,
    hideChat,
  } = useWorkspaceCanvas(workspaceId, getAssetById);

  openAssetRef.current = openAsset;
  openAssetIdRef.current = openAssetId ?? null;

  const handleChipClick = useCallback(
    (prompt: string) => {
      void sendMessage(prompt);
    },
    [sendMessage]
  );

  const handleSend = useCallback(
    (message: string, files?: File[], options?: ChatSendOptions) => {
      void sendMessage(message, files ?? [], {
        mode: options?.mode ?? "default",
        assetRefs: chatAssetRefs,
      });
    },
    [sendMessage, chatAssetRefs]
  );

  const handleAddAssetToChat = useCallback(
    (asset: WorkspaceAsset) => {
      showChat();
      addChatAssetRef(asset);
    },
    [showChat, addChatAssetRef]
  );

  useEffect(() => {
    clearChatAssetRefs();
  }, [workspaceId, clearChatAssetRefs]);

  const handleAddAssetToChatRef = useRef(handleAddAssetToChat);
  handleAddAssetToChatRef.current = handleAddAssetToChat;

  const onAddAssetToChatStable = useCallback((asset: WorkspaceAsset) => {
    handleAddAssetToChatRef.current(asset);
  }, []);

  const handleSelectAsset = useCallback(
    (assetId: string) => {
      openAsset(assetId);
    },
    [openAsset]
  );

  const handleSelectAssetRef = useRef(handleSelectAsset);
  handleSelectAssetRef.current = handleSelectAsset;

  const onSelectAssetStable = useCallback((assetId: string) => {
    handleSelectAssetRef.current(assetId);
  }, []);

  const onSearchChangeStable = useCallback((query: string) => {
    setSearchQuery(query);
  }, [setSearchQuery]);

  useEffect(() => {
    setExplorerState({
      workspaceId,
      groupedAssets,
      searchQuery,
      onSearchChange: onSearchChangeStable,
      activeAssetId: openAssetId,
      onSelectAsset: onSelectAssetStable,
      onAddAssetToChat: onAddAssetToChatStable,
    });
  }, [
    workspaceId,
    groupedAssets,
    searchQuery,
    openAssetId,
    onSearchChangeStable,
    onSelectAssetStable,
    onAddAssetToChatStable,
    setExplorerState,
  ]);

  const handleOpenAssetFromChat = useCallback(
    (artifact: WorkspaceArtifact) => {
      const resolved = resolveAssetForOpen(artifact.id, artifact);
      if (!resolved) return;
      openAssetSnapshotRef.current = resolved;
      ensureAssetInCache(resolved);
      openAsset(resolved.id);
    },
    [resolveAssetForOpen, ensureAssetInCache, openAsset]
  );

  const handleCloseAsset = useCallback(() => {
    openAssetSnapshotRef.current = null;
    closeAsset();
  }, [closeAsset]);

  const isArtifactExpanded = useCallback(
    (artifact: WorkspaceArtifact) => {
      if (!openAssetId) return false;
      const resolved = resolveAssetForOpen(artifact.id, artifact);
      return resolved?.id === openAssetId;
    },
    [openAssetId, resolveAssetForOpen]
  );

  const canvasAsset =
    activeAsset ??
    (openAssetSnapshotRef.current?.id === openAssetId
      ? openAssetSnapshotRef.current
      : undefined);

  const isCanvasOpen = Boolean(openAssetId);

  useEffect(() => {
    return () => {
      clearExplorerState();
    };
  }, [clearExplorerState]);

  if (isMobile) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {isCanvasOpen && canvasAsset ? (
          <AssetCanvas asset={canvasAsset} onClose={handleCloseAsset} className="flex-1" />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {!isCanvasOpen && messages.length === 0 ? (
              <WorkspaceOverview
                workspaceName={workspaceName}
                assets={assets}
                onSuggestionClick={handleChipClick}
                onOpenAsset={handleSelectAsset}
                className="flex-1"
              />
            ) : (
              <ConversationThread
                workspaceId={workspaceId}
                workspaceName={workspaceName}
                messages={messages}
                isResponding={isResponding}
                pendingAssistant={pendingAssistant}
                showWelcome={false}
                openAssetId={openAssetId}
                isCanvasOpen={isCanvasOpen}
                onChipClick={handleChipClick}
                onExpandArtifact={handleOpenAssetFromChat}
                onCloseArtifact={handleCloseAsset}
                isArtifactExpanded={isArtifactExpanded}
                onOpenAsset={handleSelectAsset}
                className="flex-1"
              />
            )}
            <div className="shrink-0 border-t border-border px-4 py-3">
              <PromptInputBox
                placeholder="Ask Chrysty anything..."
                isLoading={isResponding}
                maxHeight={120}
                assetRefs={chatAssetRefs}
                mentionAssets={assets}
                onRemoveAssetRef={removeChatAssetRef}
                onAddMentionAsset={handleAddAssetToChat}
                onRegisterFocus={registerChatInputFocus}
                onSend={handleSend}
                onStop={stopResponding}
                ledgerKey={ledgerKey}
                userId={userId}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn(
          "flex min-h-0 shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200",
          isChatOpen ? "w-[380px]" : "w-12"
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-end border-b border-border px-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={isChatOpen ? hideChat : showChat}
            aria-label={isChatOpen ? "Hide chat" : "Show chat"}
            className={cn("shrink-0", !isChatOpen && "mx-auto")}
          >
            {isChatOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </Button>
        </div>

        {isChatOpen && (
          <>
            <ConversationThread
              workspaceId={workspaceId}
              workspaceName={workspaceName}
              messages={messages}
              isResponding={isResponding}
              pendingAssistant={pendingAssistant}
              showWelcome={false}
              openAssetId={openAssetId}
              isCanvasOpen={isCanvasOpen}
              onChipClick={handleChipClick}
              onExpandArtifact={handleOpenAssetFromChat}
              onCloseArtifact={handleCloseAsset}
              isArtifactExpanded={isArtifactExpanded}
              onOpenAsset={handleSelectAsset}
              className="flex-1"
            />
            <div className="shrink-0 border-t border-border px-4 py-4">
              <PromptInputBox
                placeholder="Ask Chrysty anything..."
                isLoading={isResponding}
                maxHeight={160}
                assetRefs={chatAssetRefs}
                mentionAssets={assets}
                onRemoveAssetRef={removeChatAssetRef}
                onAddMentionAsset={handleAddAssetToChat}
                onRegisterFocus={registerChatInputFocus}
                onSend={handleSend}
                onStop={stopResponding}
                ledgerKey={ledgerKey}
                userId={userId}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isCanvasOpen && canvasAsset ? (
          <AssetCanvas asset={canvasAsset} onClose={handleCloseAsset} className="flex-1" />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
            <WorkspaceOverview
              workspaceName={workspaceName}
              assets={assets}
              onSuggestionClick={handleChipClick}
              onOpenAsset={handleSelectAsset}
              className="flex-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}
