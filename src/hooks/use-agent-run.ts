"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { AgentRunSseEvent } from "@/lib/agent/agent-sse-types";
import {
  formatAgentHttpError,
  isAgentTimeoutEvent,
  mapAgentStreamFailureToError,
} from "@/lib/agent/agent-stream-errors";
import { SERVERLESS_TIMEOUT_MESSAGE } from "@/lib/serverless/constants";
import { useLedger } from "@/contexts/ledger-context";

type AgentRunState = {
  runId: string | null;
  workflowId: string | null;
  status: string | null;
  steps: Array<{ stepName: string; status: string }>;
  foreachProgress: { completed: number; total: number; stepId: string } | null;
  analystLog: string;
  dataEvents: Array<{ eventType: string; payload: Record<string, unknown> }>;
  suspendPayload: unknown;
  result: unknown;
  error: string | null;
  isRunning: boolean;
};

const initialState: AgentRunState = {
  runId: null,
  workflowId: null,
  status: null,
  steps: [],
  foreachProgress: null,
  analystLog: "",
  dataEvents: [],
  suspendPayload: null,
  result: null,
  error: null,
  isRunning: false,
};

function ingestEvent(state: AgentRunState, event: AgentRunSseEvent): AgentRunState {
  switch (event.type) {
    case "workflow-start":
      return { ...state, isRunning: true, status: "running" };
    case "workflow-step-start":
      return {
        ...state,
        steps: [
          ...state.steps.filter((step) => step.stepName !== event.stepName),
          { stepName: event.stepName, status: event.status },
        ],
      };
    case "workflow-step-finish":
      return {
        ...state,
        steps: state.steps.map((step) =>
          step.stepName === event.stepName ? { ...step, status: event.status } : step
        ),
      };
    case "foreach-progress":
      return {
        ...state,
        foreachProgress: {
          completed: event.completed,
          total: event.total,
          stepId: event.stepId,
        },
      };
    case "data-event":
      if (event.eventType === "data-analyst-delta") {
        const payload = event.payload as { data?: { text?: string }; text?: string };
        const text = String(payload.data?.text ?? payload.text ?? "");
        return { ...state, analystLog: state.analystLog + text };
      }
      return {
        ...state,
        dataEvents: [...state.dataEvents, { eventType: event.eventType, payload: event.payload }],
      };
    case "run-result":
      return {
        ...state,
        runId: event.runId,
        workflowId: event.workflowId,
        status: event.status,
        suspendPayload: event.suspendPayload ?? event.suspended,
        result: event.result,
        isRunning: false,
      };
    case "error":
      return { ...state, error: event.message, isRunning: false };
    default:
      return state;
  }
}

async function consumeAgentSse(
  response: Response,
  onEvent: (event: AgentRunSseEvent) => void,
  options?: { signal?: AbortSignal; runId?: string | null }
) {
  if (!response.body) throw new Error("Empty agent response stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
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
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const event = JSON.parse(payload) as AgentRunSseEvent;
          onEvent(event);
          if (isAgentTimeoutEvent(event)) {
            throw new Error(SERVERLESS_TIMEOUT_MESSAGE);
          }
        } catch (error) {
          if (error instanceof Error && error.message === SERVERLESS_TIMEOUT_MESSAGE) {
            throw error;
          }
          // Ignore malformed chunks.
        }
      }
    }
  } catch (error) {
    throw mapAgentStreamFailureToError(error, {
      signal: options?.signal,
      hadStreamContent,
      runId: options?.runId ?? null,
    });
  }
}

export function useAgentRun(workspaceId: string) {
  const { ledgerKey, userId } = useLedger();
  const [state, setState] = useState<AgentRunState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-ledger-key": ledgerKey,
      ...(userId ? { "x-ledger-user-id": userId } : {}),
    }),
    [ledgerKey, userId]
  );

  const runAgentStream = useCallback(
    async (
      responsePromise: Promise<Response>,
      options?: { runId?: string | null }
    ) => {
      const response = await responsePromise;

      if (!response.ok) {
        const message = formatAgentHttpError(response.status, await response.text());
        setState((prev) => ({ ...prev, error: message, isRunning: false }));
        toast.error(message);
        return;
      }

      try {
        await consumeAgentSse(
          response,
          (event) => {
            setState((prev) => ingestEvent(prev, event));
          },
          { signal: abortRef.current?.signal, runId: options?.runId ?? null }
        );
      } catch (error) {
        if (abortRef.current?.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Agent workflow failed.";
        setState((prev) => ({ ...prev, error: message, isRunning: false }));
        toast.error(message);
      }
    },
    []
  );

  const runExpenseAnalysis = useCallback(
    async (options?: { assetId?: string; prompt?: string }) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setState({ ...initialState, isRunning: true, workflowId: "expenseAnalysis" });

      await runAgentStream(
        fetch(`/api/workspace/${workspaceId}/agent/expense-analysis`, {
          method: "POST",
          headers,
          body: JSON.stringify(options ?? {}),
          signal: abortRef.current.signal,
        })
      );
    },
    [headers, runAgentStream, workspaceId]
  );

  const runBulkImport = useCallback(
    async (files: Array<{ fileId: string; filename: string; textContent?: string }>) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setState({ ...initialState, isRunning: true, workflowId: "bulkImport" });

      await runAgentStream(
        fetch(`/api/workspace/${workspaceId}/agent/bulk-import`, {
          method: "POST",
          headers,
          body: JSON.stringify({ files }),
          signal: abortRef.current.signal,
        })
      );
    },
    [headers, runAgentStream, workspaceId]
  );

  const resumeRun = useCallback(
    async (resumeData: Record<string, unknown>) => {
      if (!state.runId || !state.workflowId) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setState((prev) => ({ ...prev, isRunning: true, error: null }));

      await runAgentStream(
        fetch(`/api/agent/runs/${state.runId}/resume`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            workspaceId,
            workflowId: state.workflowId,
            resumeData,
          }),
          signal: abortRef.current.signal,
        }),
        { runId: state.runId }
      );
    },
    [headers, runAgentStream, state.runId, state.workflowId, workspaceId]
  );

  return {
    ...state,
    runExpenseAnalysis,
    runBulkImport,
    resumeRun,
    approveRun: () => resumeRun({ approved: true }),
    rejectRun: () => resumeRun({ approved: false }),
  };
}
