import type OpenAI from "openai";

import type { WorkspaceArtifact } from "@/lib/artifact-types";

export type KimiThinkingType = "enabled" | "disabled";
export type KimiThinkingKeep = "all" | null;

export type KimiThinkingOptions = {
  type?: KimiThinkingType;
  keep?: KimiThinkingKeep;
};

export type KimiTextPart = {
  type: "text";
  text: string;
};

export type KimiImagePart = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

export type KimiVideoPart = {
  type: "video_url";
  video_url: {
    url: string;
  };
};

export type KimiContentPart = KimiTextPart | KimiImagePart | KimiVideoPart;

export type KimiMessageContent = string | KimiContentPart[];

export type KimiToolCall = OpenAI.Chat.Completions.ChatCompletionMessageToolCall;

export type KimiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: KimiMessageContent | null;
  reasoning_content?: string;
  tool_calls?: KimiToolCall[];
  tool_call_id?: string;
  name?: string;
  partial?: boolean;
};

export type KimiPartialMessage = {
  role: "assistant";
  content: string;
  partial: true;
  name?: string;
  reasoning_content?: string;
};

export type KimiUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type KimiStreamEvent =
  | { type: "role"; role: string }
  | { type: "reasoning"; delta: string }
  | { type: "content"; delta: string }
  | { type: "usage"; usage: KimiUsage }
  | { type: "reconnecting"; attempt: number }
  | { type: "done" };

export type KimiStreamResult = {
  content: string;
  reasoningContent: string;
  usage: KimiUsage | null;
  completed: boolean;
};

export type KimiResponseFormat = { type: "text" } | { type: "json_object" };

export type KimiCompletionResult = {
  content: string | null;
  reasoningContent: string | null;
  finishReason: string | null;
  rawMessage: unknown;
  usage: KimiUsage | null;
};

export type AttachmentInput = VisionInput;

export type MoonshotFilePurpose = "file-extract" | "image" | "video" | "batch";

export type PreparedAttachments = {
  fileSystemMessages: KimiMessage[];
  visionInputs: AttachmentInput[];
  uploadedFileIds: string[];
};

export type ResolvedVisionResult = {
  part: ResolvedVisionPart;
  fileId: string | null;
};

export type MoonshotFileSessionContext = {
  fileSystemMessages: KimiMessage[];
  visionInputs: AttachmentInput[];
  uploadedFileIds: string[];
};

export type VisionInput = {
  buffer: Buffer | Uint8Array;
  mimeType: string;
  filename: string;
  sourceAssetId?: string;
};

export type ResolvedVisionPart = KimiImagePart | KimiVideoPart;

export type ReceiptTransaction = {
  date: string;
  vendor: string;
  amount: string;
  category: string;
};

export type ReceiptExtractionJson = {
  transactions: ReceiptTransaction[];
  summary?: string;
};

export type InvoiceExtractionJson = {
  client: string;
  items: Array<{ description: string; amount: string }>;
  total: string;
  due_date?: string;
};

export class KimiJsonParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KimiJsonParseError";
  }
}

export type MoonshotBatchStatus =
  | "validating"
  | "failed"
  | "in_progress"
  | "finalizing"
  | "completed"
  | "expired"
  | "cancelling"
  | "cancelled";

export type MoonshotBatchRequestCounts = {
  completed: number;
  failed: number;
  total: number;
};

export type MoonshotBatchJob = {
  id: string;
  object: "batch";
  endpoint: string;
  input_file_id: string;
  completion_window: string;
  status: MoonshotBatchStatus;
  output_file_id: string | null;
  error_file_id: string | null;
  created_at: number;
  in_progress_at: number | null;
  expires_at: number | null;
  finalizing_at: number | null;
  completed_at: number | null;
  failed_at: number | null;
  cancelling_at: number | null;
  cancelled_at: number | null;
  request_counts: MoonshotBatchRequestCounts;
  metadata: Record<string, string> | null;
};

export type BatchChatCompletionLine = {
  custom_id: string;
  method: "POST";
  url: "/v1/chat/completions";
  body: Record<string, unknown>;
};

export type BatchOutputLine = {
  id?: string;
  custom_id: string;
  response?: {
    status_code: number;
    request_id?: string;
    body?: {
      choices?: Array<{
        index?: number;
        message?: { role?: string; content?: string | null };
        finish_reason?: string | null;
      }>;
    };
  };
  error?: { message?: string; type?: string; code?: string } | null;
};

export type ParsedBatchOutputLine = {
  customId: string;
  success: boolean;
  content: string | null;
  statusCode: number | null;
  error: string | null;
};

export type LedgerBulkExtractionItem = {
  customId?: string;
  attachment: AttachmentInput;
  userInput?: string;
};

export type LedgerBulkExtractionPerFileResult = {
  customId: string;
  filename: string;
  success: boolean;
  data?: ReceiptExtractionJson;
  error?: string;
};

export type LedgerBulkExtractionResult = {
  batchId: string;
  perFile: LedgerBulkExtractionPerFileResult[];
  merged: ReceiptExtractionJson;
  tableArtifact: WorkspaceArtifact;
  summaryText: string;
  uploadedFileIds: string[];
};

export type MoonshotWebSearchMode = "builtin" | "formula" | "off";

export type FormulaFiberResult = {
  success: boolean;
  content: string;
  error: string | null;
};

export type OfficialToolRegistry = {
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  toolToUri: Map<string, string>;
  webSearchMode: MoonshotWebSearchMode;
  formulaUris: string[];
};

export type ToolCallRecord = {
  name: string;
  success: boolean;
  error?: string;
};

export type BuiltinWebSearchArguments = Record<string, unknown> & {
  usage?: {
    total_tokens?: number;
  };
};

export type ChatSseEvent =
  | { type: "route"; route: string; phase: string }
  | { type: "phase"; name: string; status: "start" | "done" }
  | { type: "tool_call"; name: string; status: "start" | "done"; error?: string }
  | { type: "reasoning"; delta: string }
  | { type: "content"; delta: string }
  | { type: "artifact"; artifact: WorkspaceArtifact }
  | { type: "asset_created"; asset: import("@/lib/assets/asset").Asset }
  | { type: "asset_updated"; asset: import("@/lib/assets/asset").Asset }
  | { type: "asset_archived"; assetId: string }
  | { type: "replies"; replies: import("@/lib/chat-types").ChatMessage[] }
  | { type: "usage"; usage: KimiUsage; searchContentTokens?: number }
  | { type: "error"; message: string; code?: string }
  | { type: "done" };
