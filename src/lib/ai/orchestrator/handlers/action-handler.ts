import { createLedgerScope } from "@/lib/ledger/server-scope";
import { resolveActionPlan } from "@/lib/agent-actions/action-planner";
import { executeActionPlan } from "@/lib/agent-actions/executor";
import type { ActionContext } from "@/lib/agent-actions/types";
import { withMoonshotFileSession } from "@/lib/ai/attachment-routing";
import {
  buildFollowUpContextWithFallback,
  getLastAssistantText,
  referencesPriorTurn,
} from "@/lib/ai/conversation-context";
import { hasParseableNumericTables } from "@/lib/ai/orchestrator/chat-analysis-assets";
import { loadWorkingMemoryRecord } from "@/lib/ai/chat-turn-memory";
import { correlateAttachments } from "@/lib/ai/orchestrator/attachment-correlation";
import {
  hasVisionAttachments,
  shouldRouteToChat,
} from "@/lib/ai/orchestrator/action-routing";
import { runChatHandler } from "@/lib/ai/orchestrator/handlers/chat-handler";
import { maybeCreateAssetsFromTurn } from "@/lib/ai/orchestrator/turn-asset-pipeline";
import {
  userWantsVisualization,
} from "@/lib/ai/orchestrator/vision-intent";
import { getToolsForRoute } from "@/lib/ai/orchestrator/tool-profiles";
import type {
  LedgerOrchestratorOptions,
  LedgerOrchestratorResult,
} from "@/lib/ai/orchestrator/ledger-route-types";
import { assetV2ToArtifact } from "@/lib/assets/adapters/legacy";
import type { Asset } from "@/lib/assets/asset";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import { getLedgerResourceId, type LedgerScope } from "@/lib/ledger/scope";
import type { TurnAssetPipelineResult } from "@/lib/ai/orchestrator/turn-asset-pipeline";

const VIZ_FIRST_SYSTEM_NOTE =
  "Structured data from the prior analysis is being saved to the workspace canvas as sheets and charts. Keep your reply to 2-3 sentences of insights. Do not draw ASCII bar charts or ask the user to re-upload data.";

function resolveChatTools(
  mode: import("@/lib/chat-types").ChatRequestMode,
  attachmentTypes: string[]
): ReturnType<typeof getToolsForRoute> {
  if (mode === "search") {
    return getToolsForRoute("search");
  }
  if (hasVisionAttachments(attachmentTypes) || attachmentTypes.length > 0) {
    return getToolsForRoute("create_asset");
  }
  return getToolsForRoute("chat");
}

async function runChatWithOptionalAttachments(
  options: LedgerOrchestratorOptions,
  plan: {
    route: "chat" | "search";
    userFacingPhase: string;
    tools: ReturnType<typeof getToolsForRoute>;
  },
  scope: LedgerScope | null,
  memoryRecord: Awaited<ReturnType<typeof loadWorkingMemoryRecord>>
): Promise<LedgerOrchestratorResult> {
  const attachments = options.attachments ?? [];
  const mode = options.mode ?? "default";
  const onEvent = options.onEvent;
  const workspaceId = options.workspaceId ?? "";
  const appHistory = options.appHistory ?? [];

  const followUpContext = await buildFollowUpContextWithFallback({
    scope,
    workspaceId,
    appHistory,
    userInput: options.userInput,
    memoryRecord,
  });
  const baseSystemMessages = [
    ...(options.additionalSystemMessages ?? []),
    followUpContext,
  ].filter((message): message is string => Boolean(message));

  const runPipeline = async (
    chatText: string,
    correlationSummary: string | null,
    session?: {
      fileSystemMessages: import("@/lib/ai/types").KimiMessage[];
      visionInputs: import("@/lib/ai/types").AttachmentInput[];
    }
  ): Promise<TurnAssetPipelineResult> => {
    if (!scope || !workspaceId) {
      if (workspaceId && !scope) {
        console.warn("[action-handler] asset pipeline skipped: ledger scope unavailable");
      }
      return { assets: [], attempted: false, skipped: false };
    }

    return maybeCreateAssetsFromTurn({
      workspaceId,
      scope,
      userInput: options.userInput,
      chatText,
      attachments,
      visionInputs: session?.visionInputs ?? [],
      fileSystemMessages: session?.fileSystemMessages ?? [],
      appHistory,
      correlationSummary,
      memoryRecord,
      targetAssetId: options.targetAssetId,
      signal: options.signal,
      onEvent,
    });
  };

  const buildChatResult = (
    chatResult: Awaited<ReturnType<typeof runChatHandler>>,
    pipeline: TurnAssetPipelineResult,
    route: "chat" | "search"
  ): LedgerOrchestratorResult => {
    const assets = pipeline.assets;
    const text = chatResult.text;

    return {
      text,
      toolCallsExecuted: chatResult.toolCallsExecuted,
      searchContentTokens: chatResult.searchContentTokens,
      route,
      assets,
      artifact: assets[0] ? assetV2ToArtifact(assets[0]) : undefined,
      summaryText: assets.length > 0 ? `Created ${assets[0]?.title ?? "asset"}` : undefined,
      assetPipelineSkipped: pipeline.skipped,
      assetPipelineSkipReason: pipeline.skipReason,
    };
  };

  const priorAnalysis = getLastAssistantText(appHistory);
  const vizFirstEligible =
    attachments.length === 0 &&
    referencesPriorTurn(options.userInput) &&
    userWantsVisualization(options.userInput) &&
    Boolean(priorAnalysis && hasParseableNumericTables(priorAnalysis));

  const runVizFirst = async (): Promise<TurnAssetPipelineResult> => {
    if (!vizFirstEligible || !priorAnalysis) {
      return { assets: [], attempted: false, skipped: false };
    }
    return runPipeline(priorAnalysis, null);
  };

  if (attachments.length === 0) {
    const vizFirstPipeline = await runVizFirst();
    const chatSystemMessages =
      vizFirstPipeline.assets.length > 0
        ? [...baseSystemMessages, VIZ_FIRST_SYSTEM_NOTE]
        : baseSystemMessages;

    const chatResult = await runChatHandler({
      userInput: options.userInput,
      appHistory,
      attachments,
      plan: {
        route: plan.route,
        confidence: 1,
        tools: plan.tools,
        thinking: false,
        userFacingPhase: plan.userFacingPhase,
      },
      mode,
      signal: options.signal,
      onEvent,
      additionalSystemMessages: chatSystemMessages,
    });

    const pipeline =
      vizFirstPipeline.assets.length > 0
        ? vizFirstPipeline
        : await runPipeline(chatResult.text, null);

    return buildChatResult(chatResult, pipeline, plan.route);
  }

  return withMoonshotFileSession(attachments, async (session) => {
    const correlationSummary = await correlateAttachments({
      userInput: options.userInput,
      attachments,
      fileSystemMessages: session.fileSystemMessages,
      visionCount: session.visionInputs.length,
      memoryContext: baseSystemMessages.join("\n"),
      signal: options.signal,
    });

    if (correlationSummary) {
      onEvent?.({ type: "phase", name: "correlate", status: "start" });
    }

    const extraSystem = [
      ...baseSystemMessages,
      correlationSummary,
    ].filter((message): message is string => Boolean(message));

    const chatResult = await runChatHandler({
      userInput: options.userInput,
      appHistory,
      attachments,
      plan: {
        route: plan.route,
        confidence: 1,
        tools: plan.tools,
        thinking: false,
        userFacingPhase: plan.userFacingPhase,
      },
      mode,
      signal: options.signal,
      onEvent,
      additionalSystemMessages: extraSystem,
      fileSystemMessages: session.fileSystemMessages,
      visionInputs: session.visionInputs,
      onVisionUploaded: (fileIds) => {
        session.uploadedFileIds.push(...fileIds);
      },
    });

    const pipeline = await runPipeline(chatResult.text, correlationSummary, session);

    return buildChatResult(chatResult, pipeline, plan.route);
  });
}

export async function runActionHandler(
  options: LedgerOrchestratorOptions
): Promise<LedgerOrchestratorResult> {
  const attachments = options.attachments ?? [];
  const attachmentTypes = attachments.map((file) => file.mimeType);
  const mode = options.mode ?? "default";
  const onEvent = options.onEvent;
  const workspaceId = options.workspaceId ?? "";
  const ledgerKey = options.ledgerKey?.trim() ?? "";
  const resourceId = ledgerKey
    ? getLedgerResourceId(ledgerKey, options.userId)
    : options.userId?.trim() ?? "";

  const memoryRecord =
    workspaceId && resourceId
      ? await loadWorkingMemoryRecord(workspaceId, resourceId)
      : null;

  let scope: LedgerScope | null = null;
  if (workspaceId && ledgerKey) {
    try {
      scope = createLedgerScope({ ledgerKey, userId: options.userId ?? null });
    } catch {
      scope = null;
    }
  }

  const plan = await resolveActionPlan({
    userInput: options.userInput,
    attachmentCount: attachments.length,
    attachmentTypes,
    mode,
    assetCount: options.routingContext?.assetCount ?? 0,
    assetKinds: options.routingContext?.assetCategories ?? [],
    signal: options.signal,
  });

  const useChat = shouldRouteToChat({
    actions: plan.actions,
    attachmentCount: attachments.length,
    attachmentTypes,
    assetCount: options.routingContext?.assetCount ?? 0,
    mode,
  });

  if (useChat) {
    return runChatWithOptionalAttachments(
      options,
      {
        route: mode === "search" ? "search" : "chat",
        userFacingPhase: plan.userFacingPhase,
        tools: resolveChatTools(mode, attachmentTypes),
      },
      scope,
      memoryRecord
    );
  }

  const ctx: ActionContext = {
    workspaceId,
    userId: resourceId,
    ledgerKey,
    userInput: options.userInput,
    scope: scope!,
    attachments,
    signal: options.signal,
    onEvent,
    variables: {},
  };

  if (!scope || !workspaceId) {
    return runChatWithOptionalAttachments(
      options,
      {
        route: "chat",
        userFacingPhase: plan.userFacingPhase,
        tools: getToolsForRoute("chat"),
      },
      scope,
      memoryRecord
    );
  }

  try {
    const result = await executeActionPlan(plan, ctx);
    const artifacts: WorkspaceArtifact[] = result.assets.map(assetV2ToArtifact);
    const primaryArtifact = artifacts[0];

    return {
      text: result.text,
      artifact: primaryArtifact,
      summaryText: result.text,
      assets: result.assets,
      toolCallsExecuted: result.toolCallsExecuted,
      searchContentTokens: null,
      route: "create_asset",
    };
  } catch (error) {
    return {
      text: error instanceof Error ? error.message : "Import failed.",
      assets: [],
      toolCallsExecuted: [],
      searchContentTokens: null,
      route: "create_asset",
    };
  }
}

export type { Asset };
