import type { AgentRunSseEvent } from "@/lib/agent/agent-sse-types";

export type { AgentRunSseEvent } from "@/lib/agent/agent-sse-types";

export function mapMastraChunkToAgentEvent(chunk: unknown): AgentRunSseEvent | null {
  if (!chunk || typeof chunk !== "object" || !("type" in chunk)) {
    return null;
  }

  const typed = chunk as { type: string; runId?: string; payload?: Record<string, unknown> };

  switch (typed.type) {
    case "workflow-start":
      return {
        type: "workflow-start",
        runId: typed.runId,
        stepName: String(typed.payload?.stepName ?? ""),
      };
    case "workflow-step-start":
      return {
        type: "workflow-step-start",
        runId: typed.runId,
        stepName: String(typed.payload?.stepName ?? ""),
        status: String(typed.payload?.status ?? "running"),
      };
    case "workflow-step-finish":
      return {
        type: "workflow-step-finish",
        runId: typed.runId,
        stepName: String(typed.payload?.stepName ?? ""),
        status: String(typed.payload?.status ?? "success"),
      };
    case "workflow-step-progress":
      return {
        type: "foreach-progress",
        stepId: String(typed.payload?.id ?? ""),
        completed: Number(typed.payload?.completedCount ?? 0),
        total: Number(typed.payload?.totalCount ?? 0),
        status: String(typed.payload?.iterationStatus ?? ""),
      };
    case "workflow-finish":
      return {
        type: "workflow-finish",
        runId: typed.runId,
      };
    default:
      if (typed.type.startsWith("data-")) {
        return {
          type: "data-event",
          eventType: typed.type,
          payload: typed.payload ?? {},
        };
      }
      return {
        type: "raw",
        chunk: typed,
      };
  }
}
