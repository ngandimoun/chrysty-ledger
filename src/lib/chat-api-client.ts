import type { ChatMessage } from "@/lib/chat-types";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { ChatSseEvent } from "@/lib/ai/types";
import {
  CHAT_TIMEOUT_MESSAGE,
  isServerlessTimeoutEvent,
  mapStreamFailureToError,
} from "@/lib/chat-stream-errors";

export function getArtifactsFromReplies(replies: ChatMessage[]): WorkspaceArtifact[] {
  return replies
    .filter((reply) => reply.type === "artifact")
    .map((reply) => reply.artifact);
}

export type StreamChatResponseOptions = {
  signal?: AbortSignal;
  onEvent?: (event: ChatSseEvent) => void;
};

export type StreamChatResponseResult = {
  replies: ChatMessage[];
  events: ChatSseEvent[];
  aborted: boolean;
  timedOut?: boolean;
};

function parseSseBlock(block: string): ChatSseEvent | null {
  const dataLine = block
    .split("\n")
    .find((line) => line.startsWith("data: "));
  if (!dataLine) return null;

  const payload = dataLine.slice(6).trim();
  if (!payload || payload === "[DONE]") return null;

  try {
    return JSON.parse(payload) as ChatSseEvent;
  } catch {
    return null;
  }
}

export async function streamChatResponse(
  formData: FormData,
  options: StreamChatResponseOptions = {}
): Promise<StreamChatResponseResult> {
  const response = await fetch("/api/chat", {
    method: "POST",
    body: formData,
    signal: options.signal,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message =
      errorBody && typeof errorBody === "object" && "error" in errorBody
        ? String((errorBody as { error: string }).error)
        : response.status === 504
          ? CHAT_TIMEOUT_MESSAGE
          : `Chat request failed (${response.status}).`;
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Chat response stream was empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: ChatSseEvent[] = [];
  let replies: ChatMessage[] | null = null;
  let errorMessage: string | null = null;
  let errorCode: string | undefined;
  let hadStreamContent = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      hadStreamContent = true;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const event = parseSseBlock(part);
        if (!event) continue;
        events.push(event);
        options.onEvent?.(event);

        if (event.type === "replies") {
          replies = event.replies;
        }
        if (event.type === "error") {
          errorMessage = event.message;
          errorCode = event.code;
        }
      }
    }
  } catch (error) {
    if (options.signal?.aborted) {
      return { replies: replies ?? [], events, aborted: true };
    }
    throw mapStreamFailureToError(error, { signal: options.signal, hadStreamContent });
  }

  if (options.signal?.aborted) {
    return { replies: replies ?? [], events, aborted: true };
  }

  if (errorCode === "SERVERLESS_TIMEOUT") {
    throw new Error(CHAT_TIMEOUT_MESSAGE);
  }

  if (errorMessage && errorMessage !== "Request was cancelled.") {
    throw new Error(errorMessage);
  }

  if (replies) {
    return { replies, events, aborted: false };
  }

  if (errorMessage === "Request was cancelled.") {
    return { replies: [], events, aborted: true };
  }

  if (hadStreamContent && events.some(isServerlessTimeoutEvent)) {
    throw new Error(CHAT_TIMEOUT_MESSAGE);
  }

  if (hadStreamContent) {
    throw new Error(CHAT_TIMEOUT_MESSAGE);
  }

  throw new Error("Chat response did not include assistant replies.");
}
