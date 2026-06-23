export type AgentRunSseEvent =
  | { type: "workflow-start"; runId?: string; stepName: string }
  | { type: "workflow-step-start"; runId?: string; stepName: string; status: string }
  | { type: "workflow-step-finish"; runId?: string; stepName: string; status: string }
  | {
      type: "foreach-progress";
      stepId: string;
      completed: number;
      total: number;
      status: string;
    }
  | { type: "workflow-finish"; runId?: string }
  | { type: "data-event"; eventType: string; payload: Record<string, unknown> }
  | {
      type: "run-result";
      runId: string;
      workflowId: string;
      status: string;
      suspended?: unknown;
      result?: unknown;
      suspendPayload?: unknown;
    }
  | { type: "error"; message: string; code?: string }
  | { type: "raw"; chunk: unknown };
