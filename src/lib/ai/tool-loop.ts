import type OpenAI from "openai";

import { getMoonshotConfig } from "@/lib/ai/config";
import { callFormulaFiber } from "@/lib/ai/formulas-api";
import { createChatCompletion, streamChatCompletion } from "@/lib/ai/moonshot";
import { getReasoningContent } from "@/lib/ai/reasoning";
import { KimiStreamAccumulator } from "@/lib/ai/streaming";
import {
  KIMI_BUILTIN_WEB_SEARCH_NAME,
} from "@/lib/ai/official-tools";
import type {
  BuiltinWebSearchArguments,
  KimiCompletionResult,
  KimiMessage,
  KimiStreamEvent,
  KimiThinkingOptions,
  OfficialToolRegistry,
  ToolCallRecord,
} from "@/lib/ai/types";

export type RunOfficialToolLoopOptions = {
  messages: KimiMessage[];
  registry: OfficialToolRegistry;
  maxRounds?: number;
  signal?: AbortSignal;
  thinking?: KimiThinkingOptions;
  onToolCall?: (record: ToolCallRecord & { status: "start" | "done" }) => void;
  onStream?: (event: KimiStreamEvent) => void;
};

export type OfficialToolLoopResult = {
  messages: KimiMessage[];
  result: KimiCompletionResult;
  toolCallsExecuted: ToolCallRecord[];
  searchContentTokens: number | null;
};

function getToolCallFunction(
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
): { name: string; arguments: string } {
  if (toolCall.type === "function") {
    return toolCall.function;
  }
  throw new Error(`Unsupported tool call type "${toolCall.type}".`);
}
function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid tool call arguments JSON: ${raw}`);
  }
}

function assistantMessageFromRaw(rawMessage: unknown): KimiMessage {
  const message = rawMessage as OpenAI.Chat.Completions.ChatCompletionMessage;
  const kimiMessage: KimiMessage = {
    role: "assistant",
    content: message.content ?? "",
    tool_calls: message.tool_calls,
  };

  const reasoning = getReasoningContent(message);
  if (reasoning) {
    kimiMessage.reasoning_content = reasoning;
  }

  return kimiMessage;
}

async function executeToolCall(
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  registry: OfficialToolRegistry
): Promise<{ content: string; record: ToolCallRecord; searchContentTokens: number | null }> {
  const toolFunction = getToolCallFunction(toolCall);
  const functionName = toolFunction.name;
  const args = parseToolArguments(toolFunction.arguments);

  if (functionName === KIMI_BUILTIN_WEB_SEARCH_NAME) {
    const searchArgs = args as BuiltinWebSearchArguments;
    const searchContentTokens =
      typeof searchArgs.usage?.total_tokens === "number"
        ? searchArgs.usage.total_tokens
        : null;

    return {
      content: JSON.stringify(args),
      record: { name: functionName, success: true },
      searchContentTokens,
    };
  }

  const formulaUri = registry.toolToUri.get(functionName);
  if (!formulaUri) {
    const error = `No formula URI registered for tool "${functionName}".`;
    return {
      content: error,
      record: { name: functionName, success: false, error },
      searchContentTokens: null,
    };
  }

  const fiber = await callFormulaFiber(formulaUri, functionName, args);
  if (!fiber.success) {
    return {
      content: fiber.error ?? "Formula tool failed.",
      record: {
        name: functionName,
        success: false,
        error: fiber.error ?? "Formula tool failed.",
      },
      searchContentTokens: null,
    };
  }

  return {
    content: fiber.content,
    record: { name: functionName, success: true },
    searchContentTokens: null,
  };
}

async function streamFinalCompletion(
  options: RunOfficialToolLoopOptions,
  messages: KimiMessage[],
  thinking: KimiThinkingOptions | undefined
): Promise<KimiCompletionResult> {
  const accumulator = new KimiStreamAccumulator();

  for await (const event of streamChatCompletion({
    messages,
    tools: options.registry.tools,
    toolChoice: "auto",
    thinking,
    signal: options.signal,
  })) {
    if (event.type === "reasoning" || event.type === "content") {
      options.onStream?.(event);
    }
    accumulator.ingest(event);
  }

  return {
    content: accumulator.content || null,
    reasoningContent: accumulator.reasoningContent || null,
    finishReason: "stop",
    rawMessage: null,
    usage: accumulator.usage,
  };
}

export async function runOfficialToolLoop(
  options: RunOfficialToolLoopOptions
): Promise<OfficialToolLoopResult> {
  const config = getMoonshotConfig();
  const maxRounds = options.maxRounds ?? config.toolLoopMaxRounds;
  const messages = [...options.messages];
  const toolCallsExecuted: ToolCallRecord[] = [];
  let searchContentTokens: number | null = null;
  let result: KimiCompletionResult | null = null;

  const defaultThinking =
    options.thinking ??
    (options.registry.webSearchMode === "builtin" ? { type: "disabled" } : undefined);

  if (options.registry.tools.length === 0) {
    if (options.onStream) {
      result = await streamFinalCompletion(options, messages, defaultThinking);
    } else {
      result = await createChatCompletion({
        messages,
        thinking: defaultThinking,
        signal: options.signal,
      });
    }

    return {
      messages,
      result,
      toolCallsExecuted,
      searchContentTokens,
    };
  }

  for (let round = 0; round < maxRounds; round += 1) {
    if (options.signal?.aborted) {
      break;
    }

    const thinking = defaultThinking;

    const completion = await createChatCompletion({
      messages,
      tools: options.registry.tools,
      toolChoice: "auto",
      thinking,
      signal: options.signal,
    });

    result = completion;

    if (completion.finishReason !== "tool_calls" || !completion.rawMessage) {
      if (options.onStream) {
        result = await streamFinalCompletion(options, messages, thinking);
      }
      break;
    }

    const rawMessage = completion.rawMessage as OpenAI.Chat.Completions.ChatCompletionMessage;
    if (!rawMessage.tool_calls?.length) {
      break;
    }

    messages.push(assistantMessageFromRaw(rawMessage));

    for (const toolCall of rawMessage.tool_calls) {
      if (options.signal?.aborted) {
        break;
      }

      const toolFunction = getToolCallFunction(toolCall);
      options.onToolCall?.({
        name: toolFunction.name,
        status: "start",
        success: true,
      });

      const executed = await executeToolCall(toolCall, options.registry);
      toolCallsExecuted.push(executed.record);

      if (executed.searchContentTokens !== null) {
        searchContentTokens = executed.searchContentTokens;
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: toolFunction.name,
        content: executed.content,
      });

      options.onToolCall?.({
        ...executed.record,
        status: "done",
      });
    }
  }

  if (!result) {
    if (options.signal?.aborted) {
      return {
        messages,
        result: {
          content:
            "The request ran out of time before finishing tool calls. Try a simpler question or fewer attachments.",
          reasoningContent: null,
          finishReason: "stop",
          rawMessage: null,
          usage: null,
        },
        toolCallsExecuted,
        searchContentTokens,
      };
    }
    throw new Error("Tool loop did not produce a completion result.");
  }

  return {
    messages,
    result,
    toolCallsExecuted,
    searchContentTokens,
  };
}
