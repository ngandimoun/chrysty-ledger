"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { useOptionalLedgerScope } from "@/contexts/ledger-context";
import { useWorkspaceMessagesQuery } from "@/hooks/queries/use-workspace-messages-query";
import type {
  AssetRef,
  ChatMessage,
  ChatRequestMode,
  ChatSendOptions,
  FileRef,
  PendingAssistantState,
} from "@/lib/chat-types";
import { createMessageId } from "@/lib/chat-types";
import { insertAssetEvent, nextAssetSequence } from "@/lib/ledger/events";
import { insertMessage, updateMessage } from "@/lib/ledger/messages";
import { slimMessagesForApi } from "@/lib/ai/messages";
import { resolveChatTargetAssetId } from "@/lib/ai/orchestrator/turn-intent";
import { streamChatResponse } from "@/lib/chat-api-client";
import { CHAT_TIMEOUT_MESSAGE } from "@/lib/chat-stream-errors";
import { formatAttachmentProcessingStatus } from "@/lib/chat-attachment-status";
import type { Asset } from "@/lib/assets/asset";
import type { ChatSseEvent } from "@/lib/ai/types";
import { KIMI_BUILTIN_WEB_SEARCH_NAME } from "@/lib/ai/official-tools";
import { scopeCacheKey } from "@/lib/ledger/scope";
import { queryKeys } from "@/lib/query-keys";

export type ChatTurnReplyContext = {
  streamedAssetIds: string[];
};

type UseWorkspaceChatOptions = {
  getOpenAssetId?: () => string | null | undefined;
  onReplies?: (replies: ChatMessage[], context: ChatTurnReplyContext) => void;
  onAssetEvent?: (event: {
    type: "asset_created" | "asset_updated";
    asset: Asset;
  }) => void;
  onMessageSent?: () => void;
};

function toFileRefs(files: File[]): FileRef[] {
  return files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
  }));
}

function formatToolStatus(name: string, status: "start" | "done"): string {
  const labels: Record<string, { start: string; done: string }> = {
    plan: { start: "Understanding your request…", done: "Plan ready" },
    import: { start: "Reading your file…", done: "File read" },
    transform: { start: "Building your report…", done: "Report ready" },
    analyze: { start: "Analyzing your data…", done: "Analysis complete" },
    code_runner: { start: "Running calculations…", done: "Calculations complete" },
    "code-runner": { start: "Running calculations…", done: "Calculations complete" },
    excel: { start: "Reading spreadsheet…", done: "Spreadsheet read" },
    correlate: { start: "Connecting your files…", done: "Files connected" },
    vision_asset: { start: "Creating your chart…", done: "Chart ready" },
  };

  const label = labels[name];
  if (label) {
    return status === "start" ? label.start : label.done;
  }

  if (name === KIMI_BUILTIN_WEB_SEARCH_NAME || name === "web_search") {
    return status === "start" ? "Searching the web..." : "Search complete";
  }
  return status === "start" ? `Running ${name.replace(/[-_]/g, " ")}…` : `${name.replace(/[-_]/g, " ")} complete`;
}

function formatPhaseStatus(name: string): string {
  switch (name) {
    case "route":
      return "Understanding your request…";
    case "plan":
      return "Understanding your request…";
    case "extract":
      return "Extracting transactions…";
    case "import":
      return "Reading your file…";
    case "transform":
      return "Building your report…";
    case "analyze":
      return "Analyzing your data…";
    case "correlate":
      return "Connecting your files…";
    case "vision_asset":
      return "Creating your chart…";
    case "bulkImport":
      return "Running bulk import…";
    case "expenseAnalysis":
      return "Analyzing expenses…";
    default:
      return name.replace(/[-_]/g, " ");
  }
}

function applySseEvent(
  current: PendingAssistantState | null,
  event: ChatSseEvent
): PendingAssistantState | null {
  const base = current ?? { reasoning: "", content: "" };

  switch (event.type) {
    case "reasoning":
      return {
        ...base,
        reasoning: base.reasoning + event.delta,
      };
    case "content":
      return {
        ...base,
        content: base.content ? `${base.content}${event.delta}` : event.delta,
      };
    case "tool_call":
      return {
        ...base,
        toolStatus: formatToolStatus(event.name, event.status),
      };
    case "route":
      return {
        ...base,
        toolStatus: event.phase,
      };
    case "phase":
      if (event.status === "start") {
        return {
          ...base,
          toolStatus: formatPhaseStatus(event.name),
        };
      }
      return base;
    default:
      return current;
  }
}

function createAssistantErrorMessage(error: unknown): ChatMessage {
  const detail =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "Failed to send message";

  return {
    id: createMessageId(),
    role: "assistant",
    type: "text",
    content: `Something went wrong: ${detail}. Try again.`,
    createdAt: new Date().toISOString(),
  };
}

export function useWorkspaceChat(workspaceId: string, options: UseWorkspaceChatOptions = {}) {
  const { getOpenAssetId, onReplies, onAssetEvent, onMessageSent } = options;
  const scope = useOptionalLedgerScope();
  const queryClient = useQueryClient();
  const scopeKey = scope ? scopeCacheKey(scope) : null;
  const messagesQueryKey =
    scopeKey != null ? queryKeys.messages(workspaceId, scopeKey) : null;
  const assetsQueryKey =
    scopeKey != null ? queryKeys.assets(workspaceId, scopeKey) : null;
  const messagesQuery = useWorkspaceMessagesQuery(workspaceId);
  const [isResponding, setIsResponding] = useState(false);
  const [pendingAssistant, setPendingAssistant] = useState<PendingAssistantState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const messages = messagesQuery.data ?? [];
  const isHydrated = messagesQuery.isSuccess || messagesQuery.isError;

  const persistMessage = useCallback(
    async (message: ChatMessage) => {
      if (!scope) return;
      await insertMessage(scope, workspaceId, message);
    },
    [scope, workspaceId]
  );

  const recordFilesUploaded = useCallback(
    async (input: {
      files: FileRef[];
      sourceMessageId: string;
      occurredAt: string;
    }) => {
      if (!scope || input.files.length === 0) return;

      const sequence = await nextAssetSequence(scope, workspaceId);
      await insertAssetEvent(scope, {
        id: createMessageId(),
        workspaceId,
        sequence,
        type: "files_uploaded",
        occurredAt: input.occurredAt,
        files: input.files,
        sourceMessageId: input.sourceMessageId,
        title: input.files.map((file) => file.name).join(", "),
      });
    },
    [scope, workspaceId]
  );

  const sendMutation = useMutation({
    mutationFn: async (input: {
      content: string;
      files: File[];
      sendOptions?: ChatSendOptions;
      history: ChatMessage[];
    }) => {
      if (!scope) throw new Error("Ledger is not ready");

      const trimmed = input.content.trim();
      const assetRefs = input.sendOptions?.assetRefs ?? [];
      if (!trimmed && input.files.length === 0 && assetRefs.length === 0) return;

      const mode: ChatRequestMode = input.sendOptions?.mode ?? "default";

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        type: "text",
        content:
          trimmed ||
          (assetRefs.length > 0
            ? `Referenced ${assetRefs.length} asset${assetRefs.length === 1 ? "" : "s"}`
            : `Uploaded ${input.files.length} file${input.files.length === 1 ? "" : "s"}`),
        files: input.files.length > 0 ? toFileRefs(input.files) : undefined,
        assetRefs: assetRefs.length > 0 ? assetRefs : undefined,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey!, (current) => [
        ...(current ?? []),
        userMessage,
      ]);

      const persistTasks: Promise<void>[] = [persistMessage(userMessage)];
      if (userMessage.files && userMessage.files.length > 0) {
        persistTasks.push(
          recordFilesUploaded({
            files: userMessage.files,
            sourceMessageId: userMessage.id,
            occurredAt: userMessage.createdAt,
          })
        );
      }
      void Promise.all(persistTasks).catch(() => {
        toast.error("Failed to save your message. It may not appear after refresh.");
      });

      const historyForApi = slimMessagesForApi(
        queryClient.getQueryData<ChatMessage[]>(messagesQueryKey!) ??
          [...input.history, userMessage]
      );

      const formData = new FormData();
      formData.set("content", trimmed);
      formData.set("history", JSON.stringify(historyForApi));
      formData.set("mode", mode);
      formData.set("workspaceId", workspaceId);
      formData.set("ledgerKey", scope.ledgerKey);
      formData.set("sourceMessageId", userMessage.id);
      if (scope.userId) {
        formData.set("userId", scope.userId);
      }
      const targetAssetId = resolveChatTargetAssetId({
        userInput: trimmed,
        attachmentCount: input.files.length + assetRefs.length,
        openAssetId: getOpenAssetId?.() ?? null,
        referencedAssetIds: assetRefs.map((ref) => ref.id),
      });
      if (targetAssetId) {
        formData.set("targetAssetId", targetAssetId);
      }
      if (assetRefs.length > 0) {
        formData.set("referencedAssetIds", JSON.stringify(assetRefs.map((ref) => ref.id)));
      }
      for (const file of input.files) {
        formData.append("files", file);
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const streamedAssetIds = new Set<string>();
      const uploadedFileAssets: Asset[] = [];

      const { replies, aborted } = await streamChatResponse(formData, {
        signal: abortController.signal,
        onEvent: (event) => {
          setPendingAssistant((current) => applySseEvent(current, event));
          if (event.type === "error") {
            if (event.code === "SERVERLESS_TIMEOUT") {
              toast.error(CHAT_TIMEOUT_MESSAGE, {
                description: "The server stopped this request after the time limit.",
              });
            } else {
              toast.error(event.message);
            }
          }
          if (event.type === "asset_created" || event.type === "asset_updated") {
            streamedAssetIds.add(event.asset.id);
            if (
              event.type === "asset_created" &&
              event.asset.kind === "file" &&
              event.asset.subtype === "upload" &&
              event.asset.sourceMessageId === userMessage.id
            ) {
              uploadedFileAssets.push(event.asset);
            }
            onAssetEvent?.(event);
          }
        },
      });

      if (aborted) {
        return { replies: [], aborted: true, streamedAssetIds: [] };
      }

      if (uploadedFileAssets.length > 0 && userMessage.files?.length) {
        const patchedFiles = userMessage.files.map((file, index) => ({
          ...file,
          assetId: uploadedFileAssets[index]?.id ?? file.assetId,
        }));
        const patchedMessage: ChatMessage = { ...userMessage, files: patchedFiles };

        queryClient.setQueryData<ChatMessage[]>(messagesQueryKey!, (current) =>
          (current ?? []).map((message) =>
            message.id === patchedMessage.id ? patchedMessage : message
          )
        );

        void updateMessage(scope, workspaceId, patchedMessage).catch(() => {
          // Best-effort link from chat message to saved file assets.
        });
      }

      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey!, (current) => [
        ...(current ?? []),
        ...replies,
      ]);

      for (const reply of replies) {
        await persistMessage(reply);
      }

      if (assetsQueryKey) {
        void queryClient.invalidateQueries({ queryKey: assetsQueryKey });
      }

      return {
        replies,
        aborted: false,
        streamedAssetIds: Array.from(streamedAssetIds),
      };
    },
    onError: (err) => {
      if (err instanceof Error && err.name === "AbortError") return;

      const message =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Failed to send message";

      if (message === CHAT_TIMEOUT_MESSAGE) {
        toast.error(message, {
          description: "Try a shorter message, fewer files, or send again.",
        });
      } else {
        toast.error(message);
      }

      const errorReply = createAssistantErrorMessage(err);
      queryClient.setQueryData<ChatMessage[]>(messagesQueryKey!, (current) => [
        ...(current ?? []),
        errorReply,
      ]);

      if (scope) {
        void persistMessage(errorReply).catch(() => {
          // Keep the in-thread error even if persistence fails.
        });
      }
    },
  });

  const stopResponding = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (content: string, files: File[] = [], sendOptions?: ChatSendOptions) => {
      if (!scope) return;

      const trimmed = content.trim();
      const assetRefs = sendOptions?.assetRefs ?? [];
      if (!trimmed && files.length === 0 && assetRefs.length === 0) return;

      abortControllerRef.current?.abort();
      setIsResponding(true);
      setPendingAssistant({
        reasoning: "",
        content: "",
        toolStatus:
          files.length > 0 ? formatAttachmentProcessingStatus(files) : undefined,
      });

      try {
        const result = await sendMutation.mutateAsync({
          content: trimmed,
          files,
          sendOptions,
          history: messages,
        });

        if (result?.aborted) return;
        if (result?.replies) {
          onReplies?.(result.replies, {
            streamedAssetIds: result.streamedAssetIds ?? [],
          });
        }
        onMessageSent?.();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      } finally {
        abortControllerRef.current = null;
        setPendingAssistant(null);
        setIsResponding(false);
      }
    },
    [scope, sendMutation, messages, onReplies, onMessageSent]
  );

  return {
    messages,
    isHydrated,
    isResponding,
    pendingAssistant,
    sendMessage,
    stopResponding,
  };
}
