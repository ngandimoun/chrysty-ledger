import type { KimiOfficialFormulaShortName } from "@/lib/ai/official-tools";

export const AGENT_ACTIONS = [
  "create",
  "read",
  "update",
  "delete",
  "analyze",
  "transform",
  "import",
  "export",
  "search",
  "link",
] as const;

export type AgentAction = (typeof AGENT_ACTIONS)[number];

export type ActionStep = {
  action: AgentAction;
  inputs: Record<string, unknown>;
  tools?: KimiOfficialFormulaShortName[];
};

export type ActionPlan = {
  actions: ActionStep[];
  userFacingPhase: string;
  summary?: string;
};

export type ActionContext = {
  workspaceId: string;
  userId: string;
  ledgerKey: string;
  userInput: string;
  scope: import("@/lib/ledger/scope").LedgerScope;
  attachments?: import("@/lib/ai/types").AttachmentInput[];
  signal?: AbortSignal;
  onEvent?: (event: import("@/lib/ai/types").ChatSseEvent) => void;
  variables: Record<string, string>;
};

export type ActionResult = {
  text: string;
  assets: import("@/lib/assets/asset").Asset[];
  variables: Record<string, string>;
  toolCallsExecuted: import("@/lib/ai/types").ToolCallRecord[];
};
