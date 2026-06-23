import "server-only";

import { RequestContext } from "@mastra/core/request-context";

import { createSseDonePayload, createSsePayload } from "@/lib/ai/streaming";
import type { AgentRunSseEvent } from "@/lib/agent/agent-sse-types";
import { mapMastraChunkToAgentEvent } from "@/lib/agent/agent-sse";
import type { LedgerScope } from "@/lib/ledger/scope";
import {
  createServerlessBudget,
  isServerlessTimeoutError,
  SERVERLESS_TIMEOUT_CODE,
  SERVERLESS_TIMEOUT_MESSAGE,
} from "@/lib/serverless/budget";
import { LEDGER_CONTEXT_KEYS } from "@/mastra/request-context";
import type { LedgerWorkflowState } from "@/mastra/workflows/ledger-workflow-state";
import { createInitialLedgerWorkflowState } from "@/mastra/workflows/ledger-workflow-state";

type WorkflowStreamInput = {
  workflowId: "bulkImport" | "expenseAnalysis" | "scheduledReport";
  inputData: Record<string, unknown>;
  scope: LedgerScope;
  workspaceId: string;
  userId: string;
  filesTotal?: number;
};

export function buildLedgerRequestContext(scope: LedgerScope, workspaceId: string, userId: string) {
  const requestContext = new RequestContext();
  requestContext.set(LEDGER_CONTEXT_KEYS.workspaceId, workspaceId);
  requestContext.set(LEDGER_CONTEXT_KEYS.userId, userId);
  requestContext.set(LEDGER_CONTEXT_KEYS.ledgerScope, scope);
  return requestContext;
}

export function buildWorkflowInitialState(input: {
  workspaceId: string;
  userId: string;
  filesTotal?: number;
}): LedgerWorkflowState {
  return createInitialLedgerWorkflowState(input);
}

export function createAgentWorkflowSseResponse(
  streamFactory: (handlers: {
    push: (event: AgentRunSseEvent) => void;
    requestContext: RequestContext;
    initialState: LedgerWorkflowState;
    signal?: AbortSignal;
  }) => Promise<{ runId: string; workflowId: string; status: string; suspended?: unknown; result?: unknown }>,
  context: Omit<WorkflowStreamInput, "workflowId" | "inputData"> & {
    workflowId: string;
    inputData?: Record<string, unknown>;
  },
  options?: { request?: Request }
): Response {
  const encoder = new TextEncoder();
  const budget = options?.request ? createServerlessBudget(options.request.signal) : null;
  const requestContext = buildLedgerRequestContext(
    context.scope,
    context.workspaceId,
    context.userId
  );
  const initialState = buildWorkflowInitialState({
    workspaceId: context.workspaceId,
    userId: context.userId,
    filesTotal: context.filesTotal,
  });

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: AgentRunSseEvent) => {
        controller.enqueue(encoder.encode(createSsePayload(event)));
      };

      const abortHandler = () => {
        if (budget?.isTimedOut()) {
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
        budget?.dispose();
      };

      const signal = budget?.signal;
      if (signal) {
        if (signal.aborted) {
          abortHandler();
          return;
        }
        signal.addEventListener("abort", abortHandler, { once: true });
      }

      try {
        const result = await streamFactory({
          push,
          requestContext,
          initialState,
          signal: signal ?? undefined,
        });
        if (signal?.aborted) return;

        push({
          type: "run-result",
          runId: result.runId,
          workflowId: result.workflowId,
          status: result.status,
          suspended: result.suspended,
          result: result.result,
        });
        controller.enqueue(encoder.encode(createSseDonePayload()));
        controller.close();
      } catch (error) {
        if (signal?.aborted) return;

        push({
          type: "error",
          message: isServerlessTimeoutError(error)
            ? SERVERLESS_TIMEOUT_MESSAGE
            : error instanceof Error
              ? error.message
              : "Workflow stream failed.",
          code: isServerlessTimeoutError(error) ? SERVERLESS_TIMEOUT_CODE : undefined,
        });
        controller.enqueue(encoder.encode(createSseDonePayload()));
        controller.close();
      } finally {
        signal?.removeEventListener("abort", abortHandler);
        budget?.dispose();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function pipeWorkflowStream(
  stream: AsyncIterable<unknown>,
  push: (event: AgentRunSseEvent) => void
) {
  for await (const chunk of stream) {
    const mapped = mapMastraChunkToAgentEvent(chunk);
    if (mapped) push(mapped);
  }
}
