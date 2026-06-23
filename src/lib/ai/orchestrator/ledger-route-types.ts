import type { KimiOfficialFormulaShortName } from "@/lib/ai/official-tools";

export const LEDGER_ROUTES = [
  "chat",
  "search",
  "extract",
  "analyze",
  "bulk_import",
  "create_asset",
] as const;

export type LedgerRoute = (typeof LEDGER_ROUTES)[number];

export type LedgerWorkflowId = "bulkImport" | "expenseAnalysis";

export type LedgerRoutePlan = {
  route: LedgerRoute;
  confidence: number;
  tools: KimiOfficialFormulaShortName[];
  thinking: boolean;
  workflowId?: LedgerWorkflowId;
  userFacingPhase: string;
};

export type LedgerRoutingContext = {
  userInput: string;
  attachmentCount: number;
  attachmentTypes: string[];
  mode: import("@/lib/chat-types").ChatRequestMode;
  assetCount: number;
  assetCategories: string[];
  mastraEnabled: boolean;
};

export type LedgerOrchestratorOptions = {
  userInput: string;
  attachments?: import("@/lib/ai/types").AttachmentInput[];
  appHistory?: import("@/lib/chat-types").ChatMessage[];
  mode?: import("@/lib/chat-types").ChatRequestMode;
  signal?: AbortSignal;
  onEvent?: (event: import("@/lib/ai/types").ChatSseEvent) => void;
  additionalSystemMessages?: string[];
  workspaceId?: string;
  userId?: string;
  ledgerKey?: string;
  targetAssetId?: string | null;
  routingContext?: Partial<LedgerRoutingContext>;
};

export type LedgerOrchestratorResult = {
  text: string;
  artifact?: import("@/lib/artifact-types").WorkspaceArtifact;
  assets?: import("@/lib/assets/asset").Asset[];
  summaryText?: string;
  toolCallsExecuted: import("@/lib/ai/types").ToolCallRecord[];
  searchContentTokens: number | null;
  route: LedgerRoute;
  assetPipelineSkipped?: boolean;
  assetPipelineSkipReason?: string;
};
