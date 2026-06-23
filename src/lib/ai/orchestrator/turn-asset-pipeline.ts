import "server-only";

import { runKimiStructuredExtraction } from "@/lib/agent-actions/kimi-tool-runner";
import type { Asset, AssetDefinitionInput } from "@/lib/assets/asset";
import { mergeAssetDefinitionForUpdate } from "@/lib/assets/asset-merge";
import {
  createAssetV2,
  getAssetV2,
  listAssetsV2,
  updateAssetV2,
} from "@/lib/assets/service";
import type { LedgerScope } from "@/lib/ledger/scope";
import {
  extractAssetsFromChatAnalysis,
  hasParseableNumericTables,
  resolveAnalysisTextForAssets,
  sanitizeAnalysisTextForParsing,
} from "@/lib/ai/orchestrator/chat-analysis-assets";
import { getLastAssistantText, referencesPriorTurn } from "@/lib/ai/conversation-context";
import {
  extractPromptTopic,
  introducesNewTopic,
} from "@/lib/ai/orchestrator/turn-intent";
import {
  shouldAttemptAssetFromTurn,
  shouldUpdateExistingAsset,
  userWantsVisualization,
} from "@/lib/ai/orchestrator/vision-intent";
import type { AttachmentInput, ChatSseEvent, KimiMessage } from "@/lib/ai/types";
import type { ChatMessage } from "@/lib/chat-types";
import type { LedgerWorkingMemory } from "@/lib/schemas/ledger-working-memory";

export type TurnAssetPipelineInput = {
  workspaceId: string;
  scope: LedgerScope;
  userInput: string;
  chatText: string;
  attachments: AttachmentInput[];
  visionInputs: AttachmentInput[];
  fileSystemMessages: KimiMessage[];
  appHistory: ChatMessage[];
  correlationSummary?: string | null;
  memoryRecord?: LedgerWorkingMemory | null;
  targetAssetId?: string | null;
  signal?: AbortSignal;
  onEvent?: (event: ChatSseEvent) => void;
};

export type TurnAssetPipelineResult = {
  assets: Asset[];
  attempted: boolean;
  skipped: boolean;
  skipReason?: string;
};

function analysisOptions(input: TurnAssetPipelineInput) {
  return {
    attachmentCount: input.attachments.length,
    hasVision: input.visionInputs.length > 0,
  };
}

function buildExtractionPrompt(input: TurnAssetPipelineInput): string {
  const resolvedText = resolveAnalysisTextForAssets(
    input.chatText,
    input.appHistory,
    input.userInput,
    analysisOptions(input)
  );
  const topic = extractPromptTopic(input.userInput);
  const parts = [
    topic ? `User topic: ${topic}. Name all assets and charts for this topic.` : null,
    input.userInput,
    resolvedText.trim() ? `Assistant analysis:\n${resolvedText.trim()}` : null,
    input.correlationSummary,
    input.memoryRecord?.lastTurn?.summary
      ? `Prior turn: ${input.memoryRecord.lastTurn.summary}`
      : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

function pickTargetAssetIdFromMemory(
  memoryRecord?: LedgerWorkingMemory | null,
  preferredKind?: string
): string | undefined {
  const recent = memoryRecord?.recentAssets ?? [];
  if (preferredKind) {
    const match = recent.find((asset) => asset.kind === preferredKind);
    if (match) return match.assetId;
  }
  return recent[0]?.assetId;
}

async function resolveUpdateTargetAssetId(
  input: TurnAssetPipelineInput,
  preferredKind?: string
): Promise<string | undefined> {
  const priorText = getLastAssistantText(input.appHistory);
  if (introducesNewTopic(input.userInput, priorText)) {
    return undefined;
  }

  const explicit = input.targetAssetId?.trim();
  if (explicit) return explicit;

  return pickTargetAssetIdFromMemory(input.memoryRecord, preferredKind);
}

type PersistOutcome = {
  asset: Asset | null;
  errorMessage?: string;
};

function normalizeTitleKey(title: string): string {
  return title.trim().toLowerCase();
}

async function disambiguateTitleForCreate(
  scope: LedgerScope,
  workspaceId: string,
  def: AssetDefinitionInput
): Promise<AssetDefinitionInput> {
  const existing = await listAssetsV2(scope, workspaceId);
  const key = `${def.kind}::${normalizeTitleKey(def.title)}`;
  const collisions = existing.filter(
    (asset) => `${asset.kind}::${normalizeTitleKey(asset.title)}` === key
  );
  if (collisions.length === 0) return def;

  return {
    ...def,
    title: `${def.title} (${collisions.length + 1})`,
  };
}

async function persistDefinition(
  scope: LedgerScope,
  workspaceId: string,
  def: AssetDefinitionInput,
  updateAssetId: string | undefined,
  onEvent?: (event: ChatSseEvent) => void
): Promise<PersistOutcome> {
  if (updateAssetId) {
    const existing = await getAssetV2(scope, workspaceId, updateAssetId);
    if (!existing) {
      console.error("[turn-asset-pipeline] getAssetV2 not found:", updateAssetId);
      return { asset: null, errorMessage: "Asset not found" };
    }

    if (existing.kind !== def.kind) {
      const created = await createAssetV2(scope, def);
      if ("error" in created) {
        console.error("[turn-asset-pipeline] createAssetV2 failed:", created.error);
        return { asset: null, errorMessage: created.error.message };
      }
      onEvent?.({ type: "asset_created", asset: created.asset });
      return { asset: created.asset };
    }

    const merged = mergeAssetDefinitionForUpdate(existing, def);
    const updated = await updateAssetV2(scope, workspaceId, updateAssetId, {
      title: merged.title,
      schema: merged.schema,
      data: merged.data,
      metadata: merged.metadata,
      subtype: merged.subtype,
      relations: merged.relations,
    });
    if ("error" in updated) {
      console.error("[turn-asset-pipeline] updateAssetV2 failed:", updated.error);
      return { asset: null, errorMessage: updated.error.message };
    }
    onEvent?.({ type: "asset_updated", asset: updated.asset });
    return { asset: updated.asset };
  }

  const createDef = await disambiguateTitleForCreate(scope, workspaceId, def);
  const created = await createAssetV2(scope, createDef);
  if ("error" in created) {
    console.error("[turn-asset-pipeline] createAssetV2 failed:", created.error);
    return { asset: null, errorMessage: created.error.message };
  }
  onEvent?.({ type: "asset_created", asset: created.asset });
  return { asset: created.asset };
}

async function persistDefinitions(
  scope: LedgerScope,
  workspaceId: string,
  definitions: AssetDefinitionInput[],
  updateAssetId: string | undefined,
  onEvent?: (event: ChatSseEvent) => void
): Promise<{ assets: Asset[]; skipReason?: string }> {
  const assets: Asset[] = [];
  let lastError: string | undefined;
  let primaryUpdateUsed = false;

  for (const def of definitions) {
    let targetUpdateId: string | undefined;

    if (updateAssetId && !primaryUpdateUsed) {
      const primary = await getAssetV2(scope, workspaceId, updateAssetId);
      if (primary?.kind === def.kind) {
        targetUpdateId = updateAssetId;
        primaryUpdateUsed = true;
      }
    }

    const outcome = await persistDefinition(
      scope,
      workspaceId,
      def,
      targetUpdateId,
      onEvent
    );
    if (outcome.asset) {
      assets.push(outcome.asset);
    } else if (outcome.errorMessage) {
      lastError = outcome.errorMessage;
    }
  }

  return { assets, skipReason: assets.length === 0 ? lastError : undefined };
}

function buildParserInput(input: TurnAssetPipelineInput) {
  return {
    chatText: resolveAnalysisTextForAssets(
      input.chatText,
      input.appHistory,
      input.userInput,
      analysisOptions(input)
    ),
    userInput: input.userInput,
    workspaceId: input.workspaceId,
    attachmentFilename: input.attachments[0]?.filename ?? null,
  };
}

async function resolveDefinitions(input: TurnAssetPipelineInput): Promise<AssetDefinitionInput[]> {
  const parserInput = buildParserInput(input);
  const resolvedText = parserInput.chatText;
  const hasTables = hasParseableNumericTables(resolvedText);

  if (hasTables) {
    const parsed = extractAssetsFromChatAnalysis(parserInput);
    if (parsed.length > 0) return parsed;
  }

  const preferDeterministic =
    userWantsVisualization(input.userInput) &&
    hasTables &&
    (referencesPriorTurn(input.userInput) || input.attachments.length > 0);

  if (preferDeterministic) {
    const parsed = extractAssetsFromChatAnalysis(parserInput);
    if (parsed.length > 0) return parsed;
  }

  const extraction = await runKimiStructuredExtraction({
    workspaceId: input.workspaceId,
    userInput: buildExtractionPrompt(input),
    enabledTools: ["code_runner", "excel", "quickjs", "date"],
    mode: "analyze",
    fileSystemMessages: input.fileSystemMessages,
    visionInputs: input.visionInputs,
    fromChatAnalysis: input.visionInputs.length === 0,
    signal: input.signal,
    onEvent: input.onEvent,
  });

  if (extraction.definitions.length > 0) {
    return extraction.definitions;
  }

  const fallback = extractAssetsFromChatAnalysis(parserInput);
  if (fallback.length > 0) {
    return fallback;
  }

  if (extraction.errors.length > 0) {
    const retry = await runKimiStructuredExtraction({
      workspaceId: input.workspaceId,
      userInput: buildExtractionPrompt(input),
      enabledTools: ["code_runner", "excel", "quickjs", "date"],
      mode: "analyze",
      fileSystemMessages: input.fileSystemMessages,
      visionInputs: input.visionInputs,
      fromChatAnalysis: true,
      retryHints: extraction.errors,
      signal: input.signal,
      onEvent: input.onEvent,
    });

    if (retry.definitions.length > 0) {
      return retry.definitions;
    }
  }

  return [];
}

export async function maybeCreateAssetsFromTurn(
  input: TurnAssetPipelineInput
): Promise<TurnAssetPipelineResult> {
  if (!input.workspaceId) {
    return { assets: [], attempted: false, skipped: false };
  }

  const resolvedAnalysisText = resolveAnalysisTextForAssets(
    input.chatText,
    input.appHistory,
    input.userInput,
    analysisOptions(input)
  );

  const shouldAttempt = shouldAttemptAssetFromTurn({
    userInput: input.userInput,
    chatText: input.chatText,
    resolvedAnalysisText,
    attachmentCount: input.attachments.length,
    correlationSummary: input.correlationSummary,
  });

  if (!shouldAttempt) {
    return { assets: [], attempted: false, skipped: false };
  }

  input.onEvent?.({ type: "phase", name: "vision_asset", status: "start" });

  try {
    const definitions = await resolveDefinitions(input);
    if (definitions.length === 0) {
      const sanitized = sanitizeAnalysisTextForParsing(resolvedAnalysisText);
      input.onEvent?.({ type: "phase", name: "vision_asset", status: "done" });
      return {
        assets: [],
        attempted: true,
        skipped: true,
        skipReason: hasParseableNumericTables(sanitized)
          ? "Could not build workspace assets from the analysis tables."
          : "No structured tables found in the analysis to save.",
      };
    }

    const preferredKind = definitions[0]?.kind;
    const candidateTargetId = await resolveUpdateTargetAssetId(input, preferredKind);
    const updateAssetId = shouldUpdateExistingAsset({
      userInput: input.userInput,
      recentAssetId: pickTargetAssetIdFromMemory(input.memoryRecord, preferredKind),
      targetAssetId: candidateTargetId,
      attachmentCount: input.attachments.length,
    })
      ? candidateTargetId
      : undefined;

    const { assets, skipReason } = await persistDefinitions(
      input.scope,
      input.workspaceId,
      definitions,
      updateAssetId,
      input.onEvent
    );

    input.onEvent?.({ type: "phase", name: "vision_asset", status: "done" });

    return {
      assets,
      attempted: true,
      skipped: assets.length === 0,
      skipReason: assets.length === 0 ? skipReason : undefined,
    };
  } catch (error) {
    console.error("[turn-asset-pipeline] asset pipeline failed:", error);
    input.onEvent?.({ type: "phase", name: "vision_asset", status: "done" });
    return {
      assets: [],
      attempted: true,
      skipped: true,
      skipReason: error instanceof Error ? error.message : "Asset pipeline failed.",
    };
  }
}
