import type { ChatSseEvent } from "@/lib/ai/types";
import {
  SERVERLESS_TIMEOUT_CODE,
  SERVERLESS_TIMEOUT_MESSAGE,
} from "@/lib/serverless/constants";

export const CHAT_TIMEOUT_MESSAGE = SERVERLESS_TIMEOUT_MESSAGE;
export const CHAT_TIMEOUT_CODE = SERVERLESS_TIMEOUT_CODE;

export function isChatTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message === CHAT_TIMEOUT_MESSAGE ||
    error.message.includes("Chat response did not include assistant replies") ||
    error.message.includes("Chat response stream was empty")
  );
}

export function isUserAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return error instanceof Error && error.name === "AbortError";
}

export function mapStreamFailureToError(
  error: unknown,
  options: { signal?: AbortSignal; hadStreamContent: boolean }
): Error {
  if (isUserAbortError(error, options.signal)) {
    return error instanceof Error ? error : new Error("Request was cancelled.");
  }

  if (error instanceof TypeError) {
    if (options.hadStreamContent) {
      return new Error(CHAT_TIMEOUT_MESSAGE);
    }
    return new Error("Network error while streaming the chat response.");
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Chat request failed.");
}

export function isServerlessTimeoutEvent(event: ChatSseEvent): boolean {
  return event.type === "error" && event.code === SERVERLESS_TIMEOUT_CODE;
}
