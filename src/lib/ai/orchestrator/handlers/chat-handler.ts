import { resolveChatModeConfig } from "@/lib/ai/chat-modes";
import { buildChatMessagesFromAppHistory } from "@/lib/ai/messages";
import type { LedgerRoutePlan } from "@/lib/ai/orchestrator/ledger-route-types";
import { loadOfficialToolRegistry } from "@/lib/ai/tool-registry";
import { runOfficialToolLoop } from "@/lib/ai/tool-loop";
import type {
  AttachmentInput,
  ChatSseEvent,
  KimiStreamEvent,
  ToolCallRecord,
} from "@/lib/ai/types";
import type { ChatMessage } from "@/lib/chat-types";

export type ChatHandlerInput = {
  userInput: string;
  appHistory: ChatMessage[];
  attachments: AttachmentInput[];
  plan: LedgerRoutePlan;
  mode: import("@/lib/chat-types").ChatRequestMode;
  signal?: AbortSignal;
  onEvent?: (event: ChatSseEvent) => void;
  additionalSystemMessages?: string[];
  fileSystemMessages?: import("@/lib/ai/types").KimiMessage[];
  visionInputs?: AttachmentInput[];
  onVisionUploaded?: (fileIds: string[]) => void;
};

export type ChatHandlerResult = {
  text: string;
  toolCallsExecuted: ToolCallRecord[];
  searchContentTokens: number | null;
};

function forwardStreamEvent(
  onEvent: ((event: ChatSseEvent) => void) | undefined,
  streamEvent: KimiStreamEvent
) {
  if (!onEvent) return;

  if (streamEvent.type === "reasoning") {
    onEvent({ type: "reasoning", delta: streamEvent.delta });
  } else if (streamEvent.type === "content") {
    onEvent({ type: "content", delta: streamEvent.delta });
  } else if (streamEvent.type === "usage") {
    onEvent({
      type: "usage",
      usage: streamEvent.usage,
    });
  }
}

export async function runChatHandler(input: ChatHandlerInput): Promise<ChatHandlerResult> {
  const modeConfig = resolveChatModeConfig(input.mode);
  const extraSystem = (input.additionalSystemMessages ?? [])
    .filter(Boolean)
    .map((content) => ({ role: "system" as const, content }));
  const systemMessages = [...modeConfig.systemMessages, ...extraSystem];

  const thinking = input.plan.thinking
    ? { type: "enabled" as const }
    : modeConfig.thinking;

  const registry = await loadOfficialToolRegistry({
    enabledTools: input.plan.tools,
    webSearchMode:
      input.plan.route === "search" ? "builtin" : modeConfig.webSearchMode,
  });

  const messages = await buildChatMessagesFromAppHistory({
    appHistory: input.appHistory,
    userInput: input.userInput,
    fileSystemMessages: input.fileSystemMessages,
    visionInputs: input.visionInputs,
    systemMessages,
    onVisionUploaded: input.onVisionUploaded,
  });

  const loop = await runOfficialToolLoop({
    messages,
    registry,
    signal: input.signal,
    thinking,
    onToolCall: (record) => {
      input.onEvent?.({
        type: "tool_call",
        name: record.name,
        status: record.status,
        error: record.error,
      });
    },
    onStream: (event) => forwardStreamEvent(input.onEvent, event),
  });

  if (loop.result.usage) {
    input.onEvent?.({
      type: "usage",
      usage: loop.result.usage,
      searchContentTokens: loop.searchContentTokens ?? undefined,
    });
  }

  return {
    text: loop.result.content?.trim() ?? "",
    toolCallsExecuted: loop.toolCallsExecuted,
    searchContentTokens: loop.searchContentTokens,
  };
}
