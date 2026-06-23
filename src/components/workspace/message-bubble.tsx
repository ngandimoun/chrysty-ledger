"use client";

import { memo, useEffect, useState } from "react";
import { Check, FileText } from "lucide-react";

import { ChatMarkdown } from "@/components/workspace/chat-markdown";
import { InlineArtifactCard } from "@/components/workspace/inline-artifact-card";
import { useOptionalLedgerScope } from "@/contexts/ledger-context";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { ChatMessage, FileRef, AssetRef } from "@/lib/chat-types";
import { getAssetCategoryIcon } from "@/components/workspace/assets-explorer/asset-utils";
import type { AssetCategory } from "@/lib/asset-types";
import { OUTCOME_CHIPS } from "@/lib/chat-types";
import { fetchWorkspaceFileUrl } from "@/lib/workspace-file-api";
import { cn } from "@/lib/utils";

type MessageBubbleProps = {
  message: ChatMessage;
  workspaceId?: string;
  openAssetId?: string | null;
  isCanvasOpen?: boolean;
  isResponding?: boolean;
  onExpandArtifact?: (artifact: WorkspaceArtifact) => void;
  onCloseArtifact?: () => void;
  isArtifactExpanded?: (artifact: WorkspaceArtifact) => boolean;
  onOpenAsset?: (assetId: string) => void;
  onChipClick?: (prompt: string) => void;
};

function formatContent(content: string) {
  return content.split("\n").map((line, index, lines) => (
    <span key={index}>
      {line}
      {index < lines.length - 1 && <br />}
    </span>
  ));
}

function UserFileChip({
  file,
  workspaceId,
  onOpenAsset,
}: {
  file: FileRef;
  workspaceId?: string;
  onOpenAsset?: (assetId: string) => void;
}) {
  const scope = useOptionalLedgerScope();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = file.type.startsWith("image/");
  const canOpen = Boolean(file.assetId && onOpenAsset);

  useEffect(() => {
    if (!isImage || !file.assetId || !workspaceId || !scope) return;

    let cancelled = false;

    void fetchWorkspaceFileUrl({
      workspaceId,
      assetId: file.assetId,
      ledgerKey: scope.ledgerKey,
      userId: scope.userId,
    })
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [file.assetId, file.type, isImage, scope, workspaceId]);

  const content = (
    <>
      {isImage && previewUrl ? (
        <img src={previewUrl} alt={file.name} className="size-8 rounded-md object-cover" />
      ) : (
        <FileText className="size-3.5 shrink-0 opacity-80" />
      )}
      <span className="max-w-[180px] truncate">{file.name}</span>
    </>
  );

  if (canOpen && file.assetId) {
    return (
      <button
        type="button"
        onClick={() => onOpenAsset?.(file.assetId!)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/30"
      >
        {content}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-1 text-xs text-primary-foreground">
      {content}
    </span>
  );
}

function UserAssetRefChip({
  assetRef,
  onOpenAsset,
}: {
  assetRef: AssetRef;
  onOpenAsset?: (assetId: string) => void;
}) {
  const Icon = getAssetCategoryIcon(assetRef.category as AssetCategory);
  const canOpen = Boolean(onOpenAsset);

  const content = (
    <>
      <Icon className="size-3.5 shrink-0 opacity-80" />
      <span className="max-w-[180px] truncate">{assetRef.title}</span>
    </>
  );

  if (canOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpenAsset?.(assetRef.id)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/30"
      >
        {content}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-1 text-xs text-primary-foreground">
      {content}
    </span>
  );
}

function MessageBubbleComponent({
  message,
  workspaceId,
  openAssetId,
  isCanvasOpen = false,
  isResponding = false,
  onExpandArtifact,
  onCloseArtifact,
  isArtifactExpanded,
  onOpenAsset,
  onChipClick,
}: MessageBubbleProps) {
  const suppressInlinePreview = isCanvasOpen || isResponding;

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-2">
          {message.assetRefs && message.assetRefs.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {message.assetRefs.map((assetRef) => (
                <UserAssetRefChip
                  key={assetRef.id}
                  assetRef={assetRef}
                  onOpenAsset={onOpenAsset}
                />
              ))}
            </div>
          )}
          {message.files && message.files.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {message.files.map((file, index) => (
                <UserFileChip
                  key={`${file.name}-${file.assetId ?? index}`}
                  file={file}
                  workspaceId={workspaceId}
                  onOpenAsset={onOpenAsset}
                />
              ))}
            </div>
          )}
          <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
            {formatContent(message.content)}
          </div>
        </div>
      </div>
    );
  }

  if (message.type === "text") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground">
          <ChatMarkdown content={message.content} />
        </div>
      </div>
    );
  }

  if (message.type === "created") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-3 text-sm text-foreground">
          <p className="font-medium">{message.content}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {message.assets.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => onOpenAsset?.(asset.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                    "hover:bg-background/80",
                    openAssetId === asset.id && isCanvasOpen && "bg-background/80 text-primary"
                  )}
                >
                  <Check className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate">{asset.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (message.type === "updated") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-3 text-sm text-foreground">
          <p className="font-medium">{message.content}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {message.assets.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => onOpenAsset?.(asset.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                    "hover:bg-background/80",
                    openAssetId === asset.id && isCanvasOpen && "bg-background/80 text-primary"
                  )}
                >
                  <Check className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate">{asset.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (message.type === "artifact") {
    const expanded =
      isArtifactExpanded?.(message.artifact) ??
      (openAssetId === message.artifact.id && isCanvasOpen);

    return (
      <div className="flex justify-start">
        <div className="w-full max-w-xl">
          {message.summary && (
            <div className="mb-2 text-sm text-foreground">
              <ChatMarkdown content={message.summary} />
            </div>
          )}
          <InlineArtifactCard
            artifact={message.artifact}
            isExpanded={expanded}
            suppressInlinePreview={suppressInlinePreview}
            onExpand={
              onExpandArtifact || onCloseArtifact
                ? () => {
                    if (expanded) {
                      onCloseArtifact?.();
                    } else {
                      onExpandArtifact?.(message.artifact);
                    }
                  }
                : onOpenAsset
                  ? () => onOpenAsset(message.artifact.id)
                  : undefined
            }
          />
        </div>
      </div>
    );
  }

  if (message.type === "action") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%]">
          <div className="mb-3 text-sm text-foreground">
            <ChatMarkdown content={message.content} />
          </div>
          <div className="flex flex-wrap gap-2">
            {message.actions.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => onChipClick?.(chip.prompt)}
                className={cn(
                  "rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium",
                  "text-foreground transition-colors hover:border-primary/40 hover:bg-primary/8"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export const MessageBubble = memo(MessageBubbleComponent);

export { OUTCOME_CHIPS };
