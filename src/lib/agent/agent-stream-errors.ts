import { SERVERLESS_TIMEOUT_CODE, SERVERLESS_TIMEOUT_MESSAGE } from "@/lib/serverless/constants";
import type { AgentRunSseEvent } from "@/lib/agent/agent-sse-types";

export function mapAgentStreamFailureToError(
  error: unknown,
  options: { signal?: AbortSignal; hadStreamContent: boolean; runId: string | null }
): Error {
  if (options.signal?.aborted) {
    return error instanceof Error ? error : new Error("Request was cancelled.");
  }

  if (error instanceof TypeError && options.hadStreamContent) {
    const message = options.runId
      ? `${SERVERLESS_TIMEOUT_MESSAGE} You can retry or resume this run.`
      : SERVERLESS_TIMEOUT_MESSAGE;
    return new Error(message);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Agent workflow failed.");
}

export function isAgentTimeoutEvent(event: AgentRunSseEvent): boolean {
  return event.type === "error" && event.code === SERVERLESS_TIMEOUT_CODE;
}

export function formatAgentHttpError(status: number, body: string): string {
  if (status === 504) return SERVERLESS_TIMEOUT_MESSAGE;
  return body.trim() || `Agent request failed (${status}).`;
}
