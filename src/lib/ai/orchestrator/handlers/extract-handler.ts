import { withMoonshotFileSession } from "@/lib/ai/attachment-routing";
import { runChatHandler } from "@/lib/ai/orchestrator/handlers/chat-handler";
import type { LedgerRoutePlan } from "@/lib/ai/orchestrator/ledger-route-types";
import { buildExtractionMessages } from "@/lib/ai/prompts";
import {
  createJsonCompletion,
  isReceiptExtractionJson,
  receiptJsonToTableArtifact,
} from "@/lib/ai/response-modes";
import type {
  AttachmentInput,
  ChatSseEvent,
  ReceiptExtractionJson,
  ToolCallRecord,
} from "@/lib/ai/types";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { ChatMessage } from "@/lib/chat-types";

export type ExtractHandlerInput = {
  userInput: string;
  attachments: AttachmentInput[];
  appHistory: ChatMessage[];
  plan: LedgerRoutePlan;
  mode: import("@/lib/chat-types").ChatRequestMode;
  signal?: AbortSignal;
  onEvent?: (event: ChatSseEvent) => void;
  additionalSystemMessages?: string[];
};

export type ExtractHandlerResult = {
  text: string;
  artifact?: WorkspaceArtifact;
  summaryText?: string;
  toolCallsExecuted: ToolCallRecord[];
  searchContentTokens: number | null;
};

export async function runExtractHandler(
  input: ExtractHandlerInput
): Promise<ExtractHandlerResult> {
  return withMoonshotFileSession(input.attachments, async (context) => {
    input.onEvent?.({ type: "phase", name: "extract", status: "start" });

    const chat = await runChatHandler({
      userInput: input.userInput,
      appHistory: input.appHistory,
      attachments: input.attachments,
      plan: input.plan,
      mode: input.mode,
      signal: input.signal,
      onEvent: input.onEvent,
      additionalSystemMessages: input.additionalSystemMessages,
      fileSystemMessages: context.fileSystemMessages,
      visionInputs: context.visionInputs,
      onVisionUploaded: (fileIds) => {
        context.uploadedFileIds.push(...fileIds);
      },
    });

    let artifact: WorkspaceArtifact | undefined;
    let summaryText: string | undefined;

    try {
      const extractionMessages = await buildExtractionMessages({
        userInput: input.userInput,
        fileSystemMessages: context.fileSystemMessages,
        visionInputs: context.visionInputs,
        onVisionUploaded: (fileIds) => {
          context.uploadedFileIds.push(...fileIds);
        },
      });

      const jsonResult = await createJsonCompletion<ReceiptExtractionJson>({
        messages: extractionMessages,
        signal: input.signal,
      });

      if (isReceiptExtractionJson(jsonResult.data)) {
        artifact = receiptJsonToTableArtifact(jsonResult.data);
        summaryText = jsonResult.data.summary?.trim();
        input.onEvent?.({ type: "artifact", artifact });
      }
    } catch {
      // Structured extraction is best-effort after the conversational reply.
    }

    input.onEvent?.({ type: "phase", name: "extract", status: "done" });

    return {
      text: summaryText || chat.text,
      artifact,
      summaryText,
      toolCallsExecuted: chat.toolCallsExecuted,
      searchContentTokens: chat.searchContentTokens,
    };
  });
}
