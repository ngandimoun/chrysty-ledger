import type { ChatMessage } from "@/lib/chat-types";
import { createMessageId } from "@/lib/chat-types";
import { assetV2ToArtifact } from "@/lib/assets/adapters/legacy";
import type { Asset } from "@/lib/assets/asset";
import {
  runLedgerOrchestrator,
  type LedgerOrchestratorOptions,
  type LedgerOrchestratorResult,
} from "@/lib/ai/orchestrator/ledger-orchestrator";
import { userWantsVisualization } from "@/lib/ai/orchestrator/vision-intent";
import type { AttachmentInput, ChatSseEvent, ToolCallRecord } from "@/lib/ai/types";

function buildAssetPipelineSkipNote(skipReason?: string): string {
  const detail = skipReason ? ` (${skipReason})` : "";
  return `\n\n---\n\nI analyzed your data but couldn't save assets to the canvas${detail}. Try again or ask me to create a dashboard.`;
}

export type RunLedgerChatOptions = LedgerOrchestratorOptions;

export type LedgerChatResult = {
  text: string;
  artifact?: import("@/lib/artifact-types").WorkspaceArtifact;
  assets?: Asset[];
  summaryText?: string;
  toolCallsExecuted: ToolCallRecord[];
  searchContentTokens: number | null;
  route?: LedgerOrchestratorResult["route"];
  assetPipelineSkipped?: boolean;
  assetPipelineSkipReason?: string;
};

export async function runLedgerChat(options: RunLedgerChatOptions): Promise<LedgerChatResult> {
  const result = await runLedgerOrchestrator(options);
  let text = result.text;

  if (
    result.assetPipelineSkipped &&
    userWantsVisualization(options.userInput) &&
    text.trim()
  ) {
    text = `${text.trim()}${buildAssetPipelineSkipNote(result.assetPipelineSkipReason)}`;
  }

  return {
    text,
    artifact: result.artifact,
    assets: result.assets,
    summaryText: result.summaryText,
    toolCallsExecuted: result.toolCallsExecuted,
    searchContentTokens: result.searchContentTokens,
    route: result.route,
    assetPipelineSkipped: result.assetPipelineSkipped,
    assetPipelineSkipReason: result.assetPipelineSkipReason,
  };
}

export function buildAssistantRepliesFromLedgerChat(result: LedgerChatResult): ChatMessage[] {
  const createdAt = new Date().toISOString();
  const replies: ChatMessage[] = [];

  if (result.text?.trim()) {
    replies.push({
      id: createMessageId(),
      role: "assistant",
      type: "text",
      content: result.text,
      createdAt,
    });
  }

  const artifacts = result.assets
    ? result.assets.map(assetV2ToArtifact)
    : result.artifact
      ? [result.artifact]
      : [];

  for (const artifact of artifacts) {
    const sourceAsset = result.assets?.find((asset) => asset.id === artifact.id);
    const isUpdate = (sourceAsset?.version ?? 1) > 1;

    replies.push({
      id: createMessageId(),
      role: "assistant",
      type: "artifact",
      summary: isUpdate ? `Updated ${artifact.title}` : `Created ${artifact.title}`,
      artifact,
      createdAt,
    });
  }

  if (replies.length === 0) {
    replies.push({
      id: createMessageId(),
      role: "assistant",
      type: "text",
      content: "I couldn't generate a response. Please try again.",
      createdAt,
    });
  }

  return replies;
}

export type { ChatSseEvent, AttachmentInput };

