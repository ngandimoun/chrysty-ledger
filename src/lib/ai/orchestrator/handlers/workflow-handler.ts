import "server-only";

import { createMessageId } from "@/lib/chat-types";
import { mapMastraChunkToAgentEvent } from "@/lib/agent/agent-sse";
import { isMastraAgentLayerEnabled } from "@/lib/agent/mastra-enabled";
import {
  buildLedgerRequestContext,
  buildWorkflowInitialState,
} from "@/lib/agent/workflow-run";
import { runChatHandler } from "@/lib/ai/orchestrator/handlers/chat-handler";
import { runExtractHandler } from "@/lib/ai/orchestrator/handlers/extract-handler";
import type { LedgerRoutePlan } from "@/lib/ai/orchestrator/ledger-route-types";
import type { AttachmentInput, ChatSseEvent, ToolCallRecord } from "@/lib/ai/types";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { ChatMessage } from "@/lib/chat-types";
import { createLedgerScope } from "@/lib/ledger/server-scope";
import { getMastra } from "@/mastra";

export type WorkflowHandlerInput = {
  userInput: string;
  attachments: AttachmentInput[];
  appHistory: ChatMessage[];
  plan: LedgerRoutePlan;
  mode: import("@/lib/chat-types").ChatRequestMode;
  workspaceId: string;
  userId: string;
  ledgerKey: string;
  signal?: AbortSignal;
  onEvent?: (event: ChatSseEvent) => void;
  additionalSystemMessages?: string[];
};

export type WorkflowHandlerResult = {
  text: string;
  artifact?: WorkspaceArtifact;
  summaryText?: string;
  toolCallsExecuted: ToolCallRecord[];
  searchContentTokens: number | null;
};

function bridgeAgentEventToChat(
  onEvent: ((event: ChatSseEvent) => void) | undefined,
  chunk: unknown
) {
  const mapped = mapMastraChunkToAgentEvent(chunk);
  if (!mapped || !onEvent) return;

  switch (mapped.type) {
    case "workflow-step-start":
      onEvent({
        type: "phase",
        name: mapped.stepName,
        status: "start",
      });
      break;
    case "workflow-step-finish":
      onEvent({
        type: "phase",
        name: mapped.stepName,
        status: "done",
      });
      break;
    case "foreach-progress":
      onEvent({
        type: "phase",
        name: `files-${mapped.completed}-${mapped.total}`,
        status: "start",
      });
      break;
    case "data-event":
      if (mapped.eventType === "data-analyst-delta") {
        const text = String(mapped.payload.text ?? "");
        if (text) {
          onEvent({ type: "content", delta: text });
        }
      }
      break;
    case "error":
      onEvent({ type: "error", message: mapped.message });
      break;
    default:
      break;
  }
}

async function attachmentsToWorkflowFiles(
  attachments: AttachmentInput[]
): Promise<Array<{ fileId: string; filename: string; textContent?: string }>> {
  return attachments.map((attachment) => {
    const isTextLike =
      attachment.mimeType.startsWith("text/") ||
      attachment.filename.endsWith(".csv") ||
      attachment.filename.endsWith(".txt");

    return {
      fileId: createMessageId(),
      filename: attachment.filename,
      textContent: isTextLike
        ? Buffer.from(attachment.buffer).toString("utf8")
        : undefined,
    };
  });
}

export async function runWorkflowHandler(
  input: WorkflowHandlerInput
): Promise<WorkflowHandlerResult> {
  const mastra = getMastra();

  if (!mastra || !isMastraAgentLayerEnabled() || !input.plan.workflowId) {
    if (input.attachments.length > 0) {
      const extract = await runExtractHandler({
        userInput: input.userInput,
        attachments: input.attachments,
        appHistory: input.appHistory,
        plan: { ...input.plan, route: "extract", tools: ["excel", "date"] },
        mode: input.mode,
        signal: input.signal,
        onEvent: input.onEvent,
        additionalSystemMessages: input.additionalSystemMessages,
      });
      return extract;
    }

    const chat = await runChatHandler({
      userInput: input.userInput,
      appHistory: input.appHistory,
      attachments: input.attachments,
      plan: { ...input.plan, route: "chat", tools: [] },
      mode: input.mode,
      signal: input.signal,
      onEvent: input.onEvent,
      additionalSystemMessages: input.additionalSystemMessages,
    });

    return { ...chat };
  }

  const ledgerKey = input.ledgerKey || input.userId;
  const isAnonymous = ledgerKey.startsWith("ledger_") || input.userId.startsWith("ledger_");
  const scope = createLedgerScope({
    ledgerKey,
    userId: isAnonymous ? null : input.userId,
  });
  const resourceUserId = isAnonymous ? ledgerKey : input.userId;
  const requestContext = buildLedgerRequestContext(
    scope,
    input.workspaceId,
    resourceUserId
  );
  const initialState = buildWorkflowInitialState({
    workspaceId: input.workspaceId,
    userId: resourceUserId,
    filesTotal: input.attachments.length || undefined,
  });

  const workflow = mastra.getWorkflow(input.plan.workflowId);
  const run = await workflow.createRun();

  input.onEvent?.({
    type: "phase",
    name: input.plan.workflowId,
    status: "start",
  });

  let summaryText = "";

  if (input.plan.workflowId === "bulkImport") {
    const files = await attachmentsToWorkflowFiles(input.attachments);
    const stream = await run.stream({
      inputData: {
        workspaceId: input.workspaceId,
        userId: resourceUserId,
        files,
      },
      initialState: {
        ...initialState,
        filesTotal: files.length,
      },
      requestContext,
    });

    for await (const chunk of stream) {
      bridgeAgentEventToChat(input.onEvent, chunk);
    }

    const result = await stream.result;
    if (result.status === "success" && result.result && typeof result.result === "object") {
      const payload = result.result as { summary?: string };
      summaryText = payload.summary?.trim() ?? "Bulk import completed.";
    } else {
      summaryText = "Bulk import finished.";
    }
  } else {
    const stream = await run.stream({
      inputData: {
        workspaceId: input.workspaceId,
        userId: resourceUserId,
        prompt: input.userInput,
      },
      initialState,
      requestContext,
    });

    for await (const chunk of stream) {
      bridgeAgentEventToChat(input.onEvent, chunk);
    }

    const result = await stream.result;
    if (result.status === "success" && result.result && typeof result.result === "object") {
      const payload = result.result as { summary?: string; assetId?: string };
      summaryText =
        payload.summary?.trim() ?? "Expense analysis completed.";
    } else if (result.status === "suspended") {
      summaryText = "Workflow paused for approval. Check agent runs to continue.";
    } else {
      summaryText = "Analysis finished.";
    }
  }

  input.onEvent?.({
    type: "phase",
    name: input.plan.workflowId,
    status: "done",
  });

  if (summaryText && !summaryText.startsWith("Workflow")) {
    input.onEvent?.({ type: "content", delta: summaryText });
  }

  return {
    text: summaryText,
    toolCallsExecuted: [],
    searchContentTokens: null,
  };
}
