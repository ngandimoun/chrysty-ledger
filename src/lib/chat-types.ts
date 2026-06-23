import type { WorkspaceArtifact } from "@/lib/artifact-types";

export type ChatRequestMode = "default" | "search" | "think" | "canvas";

export type AssetRef = {
  id: string;
  title: string;
  kind: string;
  category: string;
};

export type ChatSendOptions = {
  mode: ChatRequestMode;
  assetRefs?: AssetRef[];
};

export type PendingAssistantState = {
  reasoning: string;
  toolStatus?: string;
  content?: string;
};

export type FileRef = {
  name: string;
  size: number;
  type: string;
  assetId?: string;
};

export type OutcomeChip = {
  id: string;
  label: string;
  prompt: string;
};

export const OUTCOME_CHIPS: OutcomeChip[] = [
  {
    id: "upload-receipts",
    label: "Upload receipts",
    prompt: "Here are my receipts for this month",
  },
  {
    id: "create-invoice",
    label: "Create invoice",
    prompt: "Create a new invoice for a client",
  },
  {
    id: "track-expenses",
    label: "Track expenses",
    prompt: "Show my expenses by category",
  },
  {
    id: "import-bank",
    label: "Import bank statement",
    prompt: "Import my bank statement",
  },
];

export type UserTextMessage = {
  id: string;
  role: "user";
  type: "text";
  content: string;
  files?: FileRef[];
  assetRefs?: AssetRef[];
  createdAt: string;
};

export type AssistantTextMessage = {
  id: string;
  role: "assistant";
  type: "text";
  content: string;
  createdAt: string;
};

export type AssistantArtifactMessage = {
  id: string;
  role: "assistant";
  type: "artifact";
  summary: string;
  artifact: WorkspaceArtifact;
  createdAt: string;
};

export type CreatedAssetRef = {
  id: string;
  title: string;
};

export type AssistantCreatedMessage = {
  id: string;
  role: "assistant";
  type: "created";
  content: string;
  assets: CreatedAssetRef[];
  createdAt: string;
};

export type AssistantUpdatedMessage = {
  id: string;
  role: "assistant";
  type: "updated";
  content: string;
  assets: CreatedAssetRef[];
  createdAt: string;
};

export type AssistantActionMessage = {
  id: string;
  role: "assistant";
  type: "action";
  content: string;
  actions: OutcomeChip[];
  createdAt: string;
};

export type ChatMessage =
  | UserTextMessage
  | AssistantTextMessage
  | AssistantArtifactMessage
  | AssistantCreatedMessage
  | AssistantUpdatedMessage
  | AssistantActionMessage;

export function createMessageId(): string {
  return crypto.randomUUID();
}
