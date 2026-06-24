import { NextResponse, type NextRequest } from "next/server";

import { persistChatUploads } from "@/lib/assets/persist-chat-uploads";
import { buildAssistantRepliesFromLedgerChat, runLedgerChat } from "@/lib/ai/ledger-chat";
import {
  buildRecentTurnContextFromMessages,
  resolveAppHistory,
} from "@/lib/ai/conversation-context";
import { buildRecentAssetsContext, recordChatTurnMemory } from "@/lib/ai/chat-turn-memory";
import {
  pickReferencedStructuredTargetAssetId,
  resolveReferencedAssets,
} from "@/lib/ai/resolve-referenced-assets";
import { buildWorkspaceMemoryContext } from "@/lib/ai/workspace-memory-context";
import { createLedgerScope } from "@/lib/ledger/server-scope";
import { getLedgerResourceId } from "@/lib/ledger/scope";
import { parseChatRequestMode } from "@/lib/ai/chat-modes";
import { isMoonshotConfigured, requireMoonshotConfig } from "@/lib/ai/config";
import { createSseDonePayload, createSsePayload } from "@/lib/ai/streaming";
import type { AttachmentInput, ChatSseEvent } from "@/lib/ai/types";
import type { ChatMessage } from "@/lib/chat-types";
import { assertCoreProductionEnv, productionEnvErrorResponse } from "@/lib/env";
import {
  PlatformAccessError,
  requirePlatformAccess,
} from "@/lib/chrysty/guard";
import { trackAgentUsage } from "@/lib/chrysty/track-usage";
import { parseLedgerIdentityFromHeaders } from "@/lib/ledger/server-scope";
import {
  createServerlessBudget,
  isServerlessTimeoutError,
  SERVERLESS_TIMEOUT_CODE,
  SERVERLESS_TIMEOUT_MESSAGE,
} from "@/lib/serverless/budget";

export const runtime = "nodejs";
export const maxDuration = 300;

function parseHistory(raw: string | null): ChatMessage[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function parseReferencedAssetIds(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  } catch {
    return [];
  }
}

async function fileToAttachment(file: File): Promise<AttachmentInput> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    buffer,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
  };
}

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAccess(request);
  } catch (error) {
    if (error instanceof PlatformAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    assertCoreProductionEnv();
  } catch (error) {
    return productionEnvErrorResponse(error);
  }

  if (!isMoonshotConfigured()) {
    return NextResponse.json(
      { error: "MOONSHOT_API_KEY is not configured." },
      { status: 503 }
    );
  }

  try {
    requireMoonshotConfig();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Moonshot is not configured." },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const content = String(formData.get("content") ?? "").trim();
  const historyValue = formData.get("history");
  let history = parseHistory(typeof historyValue === "string" ? historyValue : null);
  const modeValue = formData.get("mode");
  const mode = parseChatRequestMode(typeof modeValue === "string" ? modeValue : null);
  const workspaceIdValue = formData.get("workspaceId");
  const workspaceId = typeof workspaceIdValue === "string" ? workspaceIdValue.trim() : "";
  const ledgerKeyValue = formData.get("ledgerKey");
  const ledgerKey =
    parseLedgerIdentityFromHeaders(request)?.ledgerKey ??
    (typeof ledgerKeyValue === "string" ? ledgerKeyValue.trim() : "");

  if (!ledgerKey) {
    return NextResponse.json({ error: "Missing ledger key." }, { status: 401 });
  }

  const userIdValue = formData.get("userId");
  const rawUserId = typeof userIdValue === "string" ? userIdValue.trim() : "";
  const targetAssetIdValue = formData.get("targetAssetId");
  let targetAssetId =
    typeof targetAssetIdValue === "string" && targetAssetIdValue.trim()
      ? targetAssetIdValue.trim()
      : null;
  const referencedAssetIdsValue = formData.get("referencedAssetIds");
  const referencedAssetIds = parseReferencedAssetIds(
    typeof referencedAssetIdsValue === "string" ? referencedAssetIdsValue : null
  );
  const sourceMessageIdValue = formData.get("sourceMessageId");
  const sourceMessageId =
    typeof sourceMessageIdValue === "string" && sourceMessageIdValue.trim()
      ? sourceMessageIdValue.trim()
      : null;
  const resourceId = ledgerKey ? getLedgerResourceId(ledgerKey, rawUserId || null) : rawUserId;
  const fileEntries = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (!content && fileEntries.length === 0 && referencedAssetIds.length === 0) {
    return NextResponse.json(
      { error: "Message content, files, or asset references are required." },
      { status: 400 }
    );
  }

  const uploadedAttachments = await Promise.all(fileEntries.map(fileToAttachment));
  const encoder = new TextEncoder();
  const budget = createServerlessBudget(request.signal);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (event: ChatSseEvent) => {
        controller.enqueue(encoder.encode(createSsePayload(event)));
      };

      const abortHandler = () => {
        if (budget.isTimedOut()) {
          push({
            type: "error",
            message: SERVERLESS_TIMEOUT_MESSAGE,
            code: SERVERLESS_TIMEOUT_CODE,
          });
        } else {
          push({
            type: "error",
            message: "Request was cancelled.",
          });
        }
        controller.enqueue(encoder.encode(createSseDonePayload()));
        controller.close();
        budget.dispose();
      };

      if (budget.signal.aborted) {
        abortHandler();
        return;
      }

      budget.signal.addEventListener("abort", abortHandler, { once: true });

      void (async () => {
        try {
          const systemMessages: string[] = [];
          let scope: ReturnType<typeof createLedgerScope> | null = null;
          if (workspaceId && ledgerKey) {
            try {
              scope = createLedgerScope({ ledgerKey, userId: rawUserId || null });
            } catch {
              scope = null;
            }
          }

          if (scope && workspaceId) {
            history = await resolveAppHistory(scope, workspaceId, history);
          }

          if (workspaceId && resourceId) {
            const memoryContext = await buildWorkspaceMemoryContext(workspaceId, resourceId);
            if (memoryContext) {
              systemMessages.push(memoryContext);
            } else if (scope) {
              const recentTurnContext = await buildRecentTurnContextFromMessages(scope, workspaceId);
              if (recentTurnContext) systemMessages.push(recentTurnContext);
            }
          }
          if (scope && workspaceId) {
            try {
              const recentAssetsContext = await buildRecentAssetsContext(scope, workspaceId);
              if (recentAssetsContext) systemMessages.push(recentAssetsContext);
            } catch {
              // Best-effort recent assets context.
            }
          }

          let referencedAttachments: AttachmentInput[] = [];
          if (scope && workspaceId && referencedAssetIds.length > 0) {
            try {
              const resolved = await resolveReferencedAssets({
                scope,
                workspaceId,
                assetIds: referencedAssetIds,
              });
              referencedAttachments = resolved.attachments;
              if (resolved.systemMessages.length > 0) {
                systemMessages.push(...resolved.systemMessages);
              }
              if (!targetAssetId) {
                targetAssetId = pickReferencedStructuredTargetAssetId(resolved.resolved) ?? null;
              }
            } catch (error) {
              console.error("[chat] resolveReferencedAssets failed:", error);
            }
          }

          const referencedSourceIds = new Set(
            referencedAttachments
              .map((attachment) => attachment.sourceAssetId)
              .filter((id): id is string => Boolean(id))
          );
          const attachments = [
            ...referencedAttachments,
            ...uploadedAttachments.filter(
              (attachment) =>
                !attachment.sourceAssetId || !referencedSourceIds.has(attachment.sourceAssetId)
            ),
          ];

          if (scope && workspaceId && uploadedAttachments.length > 0) {
            try {
              await persistChatUploads({
                scope,
                workspaceId,
                attachments: uploadedAttachments,
                sourceMessageId: sourceMessageId ?? undefined,
                onEvent: push,
              });
            } catch (error) {
              console.error("[chat] persistChatUploads failed:", error);
            }
          }

          const result = await runLedgerChat({
            userInput: content || "Analyze the attached files.",
            attachments,
            appHistory: history,
            mode,
            signal: budget.signal,
            onEvent: push,
            additionalSystemMessages:
              systemMessages.length > 0 ? systemMessages : undefined,
            workspaceId,
            userId: rawUserId || resourceId,
            ledgerKey,
            targetAssetId,
          });

          if (budget.signal.aborted) {
            return;
          }

          if (workspaceId && resourceId) {
            await recordChatTurnMemory({
              workspaceId,
              userId: resourceId,
              route: result.route ?? "chat",
              userInput: content || "Analyze the attached files.",
              assistantSummary: result.text,
              attachmentNames: attachments.map((file) => file.filename),
              assetIds: result.assets?.map((asset) => asset.id),
              searchTopic: mode === "search" ? content : undefined,
            });
          }

          const replies = buildAssistantRepliesFromLedgerChat(result);
          push({ type: "replies", replies });
          try {
            await trackAgentUsage({
              inputTokens: Math.ceil((content || "").length / 4),
              outputTokens: Math.ceil((result.text || "").length / 4),
            });
          } catch (usageError) {
            console.error("[chat] trackAgentUsage failed:", usageError);
          }
          controller.enqueue(encoder.encode(createSseDonePayload()));
          controller.close();
        } catch (error) {
          if (budget.signal.aborted) {
            return;
          }

          push({
            type: "error",
            message: isServerlessTimeoutError(error)
              ? SERVERLESS_TIMEOUT_MESSAGE
              : error instanceof Error
                ? error.message
                : "Chat request failed.",
            code: isServerlessTimeoutError(error) ? SERVERLESS_TIMEOUT_CODE : undefined,
          });
          controller.enqueue(encoder.encode(createSseDonePayload()));
          controller.close();
        } finally {
          budget.signal.removeEventListener("abort", abortHandler);
          budget.dispose();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
