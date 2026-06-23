"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ChatTypingIndicator } from "@/components/workspace/chat-typing-indicator";
import { ChatMarkdown } from "@/components/workspace/chat-markdown";
import { MessageBubble } from "@/components/workspace/message-bubble";
import { WorkspaceOverview } from "@/components/workspace/workspace-overview";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { ChatMessage, PendingAssistantState } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

const VISIBLE_MESSAGE_LIMIT = 60;

type ConversationThreadProps = {
  workspaceId: string;
  workspaceName: string;
  messages: ChatMessage[];
  assets?: import("@/lib/asset-types").WorkspaceAsset[];
  isResponding?: boolean;
  pendingAssistant?: PendingAssistantState | null;
  showWelcome?: boolean;
  openAssetId?: string | null;
  isCanvasOpen?: boolean;
  onChipClick: (prompt: string) => void;
  onExpandArtifact?: (artifact: WorkspaceArtifact) => void;
  onCloseArtifact?: () => void;
  isArtifactExpanded?: (artifact: WorkspaceArtifact) => boolean;
  onOpenAsset?: (assetId: string) => void;
  className?: string;
};

function PendingAssistantBubble({ state }: { state: PendingAssistantState }) {
  const [showReasoning, setShowReasoning] = useState(true);
  const hasReasoning = state.reasoning.trim().length > 0;
  const hasContent = Boolean(state.content?.trim());
  const hasToolStatus = Boolean(state.toolStatus);

  if (!hasReasoning && !hasContent && !hasToolStatus) {
    return (
      <div className="flex justify-start">
        <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
          <ChatTypingIndicator />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2 rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground">
        {hasToolStatus && (
          <p className="text-xs text-[#1EAEDB]">{state.toolStatus}</p>
        )}
        {hasReasoning && (
          <div>
            <button
              type="button"
              onClick={() => setShowReasoning((current) => !current)}
              className="mb-1 text-xs font-medium text-[#8B5CF6] hover:underline"
            >
              {showReasoning ? "Hide thinking" : "Show thinking"}
            </button>
            {showReasoning && (
              <p className="whitespace-pre-wrap text-xs text-[#8B5CF6]/90">{state.reasoning}</p>
            )}
          </div>
        )}
        {hasContent && <ChatMarkdown content={state.content ?? ""} />}
        {!hasContent && <ChatTypingIndicator />}
      </div>
    </div>
  );
}

export function ConversationThread({
  workspaceId,
  workspaceName,
  messages,
  assets = [],
  isResponding = false,
  pendingAssistant = null,
  showWelcome = true,
  openAssetId,
  isCanvasOpen = false,
  onChipClick,
  onExpandArtifact,
  onCloseArtifact,
  isArtifactExpanded,
  onOpenAsset,
  className,
}: ConversationThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hiddenMessageCount = Math.max(0, messages.length - VISIBLE_MESSAGE_LIMIT);
  const visibleMessages = useMemo(
    () => (hiddenMessageCount > 0 ? messages.slice(-VISIBLE_MESSAGE_LIMIT) : messages),
    [messages, hiddenMessageCount]
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length, isResponding]);

  const isEmpty = messages.length === 0;

  return (
    <div className={cn("flex-1 overflow-y-auto px-4 py-6 sm:px-6", className)}>
      {isEmpty && showWelcome ? (
        <WorkspaceOverview
          workspaceName={workspaceName}
          assets={assets}
          onSuggestionClick={onChipClick}
          onOpenAsset={onOpenAsset}
        />
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {hiddenMessageCount > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Showing the latest {VISIBLE_MESSAGE_LIMIT} messages ({hiddenMessageCount} earlier hidden)
            </p>
          )}
          {visibleMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              workspaceId={workspaceId}
              openAssetId={openAssetId}
              isCanvasOpen={isCanvasOpen}
              isResponding={isResponding}
              onExpandArtifact={onExpandArtifact}
              onCloseArtifact={onCloseArtifact}
              isArtifactExpanded={isArtifactExpanded}
              onOpenAsset={onOpenAsset}
              onChipClick={onChipClick}
            />
          ))}
          {isResponding && pendingAssistant && (
            <PendingAssistantBubble state={pendingAssistant} />
          )}
          {isResponding && !pendingAssistant && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                <ChatTypingIndicator />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
