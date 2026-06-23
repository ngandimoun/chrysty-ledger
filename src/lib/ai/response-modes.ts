import { createMessageId } from "@/lib/chat-types";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import { parseWorkspaceArtifact } from "@/lib/schemas/artifacts";
import { createChatCompletion, type CreateChatCompletionOptions } from "@/lib/ai/moonshot";
import type {
  InvoiceExtractionJson,
  KimiMessage,
  KimiPartialMessage,
  KimiThinkingOptions,
  ReceiptExtractionJson,
} from "@/lib/ai/types";
import { KimiJsonParseError } from "@/lib/ai/types";

export const JSON_RESPONSE_FORMAT = { type: "json_object" as const };

export function parseJsonCompletion<T extends Record<string, unknown>>(content: string | null): T {
  if (!content?.trim()) {
    throw new KimiJsonParseError("Kimi returned empty JSON content");
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new KimiJsonParseError("Kimi JSON Mode must return a JSON Object at the root");
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof KimiJsonParseError) throw error;
    throw new KimiJsonParseError(
      error instanceof Error ? error.message : "Failed to parse Kimi JSON response"
    );
  }
}

export type CreateJsonCompletionOptions = Omit<CreateChatCompletionOptions, "responseFormat"> & {
  autoContinue?: boolean;
};

export type JsonCompletionResult<T extends Record<string, unknown>> = {
  data: T;
  finishReason: string | null;
  content: string;
  reasoningContent: string | null;
};

export async function createJsonCompletion<T extends Record<string, unknown>>(
  options: CreateJsonCompletionOptions
): Promise<JsonCompletionResult<T>> {
  if (options.autoContinue) {
    const continued = await createCompletionWithContinuation(options);
    return {
      data: parseJsonCompletion<T>(continued.content),
      finishReason: continued.finishReason,
      content: continued.content ?? "",
      reasoningContent: continued.reasoningContent,
    };
  }

  const result = await createChatCompletion({
    ...options,
    responseFormat: JSON_RESPONSE_FORMAT,
  });

  return {
    data: parseJsonCompletion<T>(result.content),
    finishReason: result.finishReason,
    content: result.content ?? "",
    reasoningContent: result.reasoningContent,
  };
}

export function buildPartialMessage(options: {
  content: string;
  reasoningContent?: string | null;
  name?: string;
}): KimiPartialMessage {
  const message: KimiPartialMessage = {
    role: "assistant",
    partial: true,
    content: options.content,
  };

  if (options.name) message.name = options.name;
  if (options.reasoningContent) message.reasoning_content = options.reasoningContent;

  return message;
}

export type ContinueFromPartialOptions = {
  messages: KimiMessage[];
  prefix: string;
  reasoningContent?: string | null;
  maxTokens?: number;
  thinking?: KimiThinkingOptions;
  model?: string;
  signal?: AbortSignal;
};

export async function continueFromPartial(options: ContinueFromPartialOptions) {
  const continuationMessages: KimiMessage[] = [
    ...options.messages,
    buildPartialMessage({
      content: options.prefix,
      reasoningContent: options.reasoningContent,
    }),
  ];

  return createChatCompletion({
    messages: continuationMessages,
    maxTokens: options.maxTokens,
    thinking: options.thinking,
    model: options.model,
    signal: options.signal,
  });
}

export type CreateCompletionWithContinuationOptions = CreateChatCompletionOptions & {
  continuationMaxTokens?: number;
};

export async function createCompletionWithContinuation(
  options: CreateCompletionWithContinuationOptions
) {
  const initial = await createChatCompletion(options);

  if (initial.finishReason !== "length" || !initial.content) {
    return initial;
  }

  const continued = await continueFromPartial({
    messages: options.messages,
    prefix: initial.content,
    reasoningContent: initial.reasoningContent,
    maxTokens: options.continuationMaxTokens ?? options.maxTokens,
    thinking: options.thinking,
    model: options.model,
    signal: options.signal,
  });

  return {
    content: initial.content + (continued.content ?? ""),
    reasoningContent: [initial.reasoningContent, continued.reasoningContent]
      .filter(Boolean)
      .join(""),
    finishReason: continued.finishReason,
    rawMessage: continued.rawMessage,
    usage: continued.usage,
  };
}

export function receiptJsonToTableArtifact(json: ReceiptExtractionJson): WorkspaceArtifact {
  return parseWorkspaceArtifact({
    id: createMessageId(),
    kind: "table",
    title: json.summary?.trim() || "Extracted Transactions",
    columns: ["Date", "Vendor", "Amount", "Category"],
    rows: json.transactions.map((row) => ({
      Date: row.date,
      Vendor: row.vendor,
      Amount: row.amount,
      Category: row.category,
    })),
  });
}

export function isReceiptExtractionJson(value: Record<string, unknown>): value is ReceiptExtractionJson {
  return Array.isArray(value.transactions);
}

export function isInvoiceExtractionJson(value: Record<string, unknown>): value is InvoiceExtractionJson {
  return typeof value.client === "string" && Array.isArray(value.items) && typeof value.total === "string";
}

export type { KimiJsonParseError };
