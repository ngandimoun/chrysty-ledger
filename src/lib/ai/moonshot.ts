import type OpenAI from "openai";

import { getMoonshotConfig, requireMoonshotConfig } from "@/lib/ai/config";
import { DEFAULT_MAX_TOKENS, MIN_MAX_TOKENS_FOR_TOOLS } from "@/lib/ai/kimi-k26";
import { createMoonshotClient } from "@/lib/ai/moonshot-client";
import { getReasoningContent } from "@/lib/ai/reasoning";
import { normalizeUsage, withRetry, withStreamRetry } from "@/lib/ai/retry";
import { collectStream } from "@/lib/ai/streaming";
import type {
  KimiCompletionResult,
  KimiMessage,
  KimiResponseFormat,
  KimiStreamEvent,
  KimiThinkingOptions,
} from "@/lib/ai/types";

export { createMoonshotClient } from "@/lib/ai/moonshot-client";

export type CreateChatCompletionOptions = {
  messages: KimiMessage[];
  model?: string;
  maxTokens?: number;
  thinking?: KimiThinkingOptions;
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  toolChoice?: "auto" | "none" | "required";
  responseFormat?: KimiResponseFormat;
  signal?: AbortSignal;
};

function resolveMaxTokens(maxTokens: number | undefined, hasTools: boolean): number {
  const resolved = maxTokens ?? DEFAULT_MAX_TOKENS;
  if (hasTools && resolved < MIN_MAX_TOKENS_FOR_TOOLS) {
    return MIN_MAX_TOKENS_FOR_TOOLS;
  }
  return resolved;
}

export type BuildBatchChatCompletionBodyOptions = {
  messages: KimiMessage[];
  model?: string;
  maxTokens?: number;
  responseFormat?: KimiResponseFormat;
};

/** Batch-safe chat completion body — no stream, sampling, thinking, or tools. */
export function buildBatchChatCompletionBody(
  options: BuildBatchChatCompletionBodyOptions
): Record<string, unknown> {
  const config = requireMoonshotConfig();
  const maxTokens = resolveMaxTokens(options.maxTokens, false);

  const body: Record<string, unknown> = {
    model: options.model ?? config.model,
    messages: options.messages,
    max_tokens: maxTokens,
  };

  if (options.responseFormat?.type === "json_object") {
    body.response_format = { type: "json_object" };
  }

  return body;
}

function buildCompletionParams(
  options: CreateChatCompletionOptions,
  stream: boolean
): OpenAI.Chat.Completions.ChatCompletionCreateParams {
  const config = requireMoonshotConfig();
  const hasTools = Boolean(options.tools?.length);
  const maxTokens = resolveMaxTokens(options.maxTokens, hasTools);

  const params: Record<string, unknown> = {
    model: options.model ?? config.model,
    messages: options.messages,
    max_tokens: maxTokens,
    stream,
  };

  if (options.tools?.length) {
    params.tools = options.tools;
    params.tool_choice = options.toolChoice ?? "auto";
  }

  if (options.responseFormat?.type === "json_object") {
    params.response_format = { type: "json_object" };
  }

  if (options.thinking) {
    params.thinking = options.thinking;
  }

  return params as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParams;
}

function toCompletionResult(completion: OpenAI.Chat.Completions.ChatCompletion): KimiCompletionResult {
  const choice = completion.choices[0];
  const message = choice?.message;

  return {
    content: message?.content ?? null,
    reasoningContent: message ? getReasoningContent(message) : null,
    finishReason: choice?.finish_reason ?? null,
    rawMessage: message ?? null,
    usage: normalizeUsage(completion.usage),
  };
}

export async function createChatCompletion(
  options: CreateChatCompletionOptions
): Promise<KimiCompletionResult> {
  return withRetry(async () => {
    const client = createMoonshotClient();
    const params = buildCompletionParams(options, false);

    const completion = await client.chat.completions.create(
      params as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      { signal: options.signal }
    );

    return toCompletionResult(completion);
  });
}

async function* runStreamCompletion(
  options: CreateChatCompletionOptions
): AsyncGenerator<KimiStreamEvent> {
  const client = createMoonshotClient();
  const params = buildCompletionParams(options, true);

  const stream = await client.chat.completions.create(
    params as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
    { signal: options.signal }
  );

  yield* collectStream(stream);
}

export async function* streamChatCompletion(
  options: CreateChatCompletionOptions
): AsyncGenerator<KimiStreamEvent> {
  yield* withStreamRetry(() => runStreamCompletion(options));
}

export function getDefaultMoonshotModel(): string {
  return getMoonshotConfig().model;
}
