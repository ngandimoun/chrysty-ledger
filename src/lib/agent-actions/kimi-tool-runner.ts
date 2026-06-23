import type { Asset, AssetDefinitionInput } from "@/lib/assets/asset";
import { validateAndNormalizeAsset } from "@/lib/assets/validation/gate";
import { buildStructuredExtractionMessages } from "@/lib/agent-actions/prompts/structured-asset";
import { loadOfficialToolRegistry } from "@/lib/ai/tool-registry";
import { runOfficialToolLoop } from "@/lib/ai/tool-loop";
import { buildVisionUserMessageFromInputs } from "@/lib/ai/vision";
import type { KimiOfficialFormulaShortName } from "@/lib/ai/official-tools";
import { KimiJsonParseError } from "@/lib/ai/types";
import type {
  AttachmentInput,
  ChatSseEvent,
  KimiMessage,
  ToolCallRecord,
} from "@/lib/ai/types";

export type KimiStructuredExtractionInput = {
  workspaceId: string;
  userInput: string;
  enabledTools: KimiOfficialFormulaShortName[];
  mode: "import" | "transform" | "analyze";
  fileSystemMessages?: KimiMessage[];
  visionInputs?: AttachmentInput[];
  sourceAssets?: Asset[];
  targetKind?: string;
  subtype?: string;
  fromChatAnalysis?: boolean;
  retryHints?: string[];
  signal?: AbortSignal;
  onEvent?: (event: ChatSseEvent) => void;
};

export type KimiStructuredExtractionResult = {
  definitions: AssetDefinitionInput[];
  toolCallsExecuted: ToolCallRecord[];
  summary?: string;
  errors: string[];
};

function looksLikeProseSummary(content: string | null): string | undefined {
  if (!content?.trim()) return undefined;
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return undefined;
  return trimmed;
}

function extractJsonObject(content: string | null): Record<string, unknown> {
  if (!content?.trim()) {
    throw new KimiJsonParseError("Empty model response");
  }

  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch?.[1]?.trim() ?? trimmed;

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new KimiJsonParseError("Expected JSON object at root");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof KimiJsonParseError) throw error;
    throw new KimiJsonParseError(
      error instanceof Error ? error.message : "Failed to parse structured asset JSON"
    );
  }
}

function parseAssetDefinitions(
  payload: Record<string, unknown>,
  workspaceId: string
): Omit<AssetDefinitionInput, "workspaceId">[] {
  const rawAssets = Array.isArray(payload.assets)
    ? payload.assets
    : payload.kind
      ? [payload]
      : [];

  return rawAssets
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      kind: String(item.kind ?? "document"),
      subtype: item.subtype ? String(item.subtype) : undefined,
      title: String(item.title ?? "Untitled"),
      schema: (item.schema as Record<string, unknown>) ?? {},
      data: (item.data as Record<string, unknown>) ?? {},
      metadata: (item.metadata as Record<string, unknown>) ?? {},
      relations: Array.isArray(item.relations)
        ? (item.relations as AssetDefinitionInput["relations"])
        : [],
    }));
}

function validateDefinitions(
  definitions: Omit<AssetDefinitionInput, "workspaceId">[],
  workspaceId: string
): { valid: AssetDefinitionInput[]; errors: string[]; hints: string[] } {
  const valid: AssetDefinitionInput[] = [];
  const errors: string[] = [];
  const hints: string[] = [];

  for (const def of definitions) {
    const result = validateAndNormalizeAsset({ workspaceId, ...def });
    if (result.ok) {
      valid.push({
        workspaceId,
        kind: result.asset.kind,
        subtype: result.asset.subtype,
        title: result.asset.title,
        schema: result.asset.schema,
        data: result.asset.data,
        metadata: result.asset.metadata,
        relations: result.asset.relations,
      });
    } else {
      errors.push(...result.errors);
      hints.push(...result.hints);
    }
  }

  return { valid, errors, hints };
}

async function runExtractionLoop(
  input: KimiStructuredExtractionInput,
  retryHints?: string[]
): Promise<{ content: string | null; toolCallsExecuted: ToolCallRecord[] }> {
  const registry = await loadOfficialToolRegistry({
    enabledTools: input.enabledTools,
    webSearchMode: "off",
  });

  const sourceContext =
    input.sourceAssets && input.sourceAssets.length > 0
      ? {
          assets: input.sourceAssets.map((a) => ({
            id: a.id,
            kind: a.kind,
            subtype: a.subtype,
            title: a.title,
            schema: a.schema,
            data: a.data,
          })),
        }
      : undefined;

  let messages = buildStructuredExtractionMessages({
    userInput: input.userInput,
    fileSystemMessages: input.fileSystemMessages,
    sourceContext,
    targetKind: input.targetKind,
    subtype: input.subtype,
    mode: input.mode,
    fromChatAnalysis: input.fromChatAnalysis,
    retryHints: retryHints ?? input.retryHints,
  });

  if (input.visionInputs?.length) {
    const visionMessage = await buildVisionUserMessageFromInputs({
      userInput: input.userInput,
      visionInputs: input.visionInputs,
    });
    messages = [
      ...messages.slice(0, -1),
      { role: "user", content: visionMessage.content },
    ];
  }

  const loop = await runOfficialToolLoop({
    messages,
    registry,
    signal: input.signal,
    thinking: { type: "disabled" },
    onToolCall: (record) => {
      input.onEvent?.({
        type: "tool_call",
        name: record.name,
        status: record.status,
        error: record.error,
      });
    },
  });

  return {
    content: loop.result.content,
    toolCallsExecuted: loop.toolCallsExecuted,
  };
}

export async function runKimiStructuredExtraction(
  input: KimiStructuredExtractionInput
): Promise<KimiStructuredExtractionResult> {
  const allToolCalls: ToolCallRecord[] = [];
  const errors: string[] = [];

  try {
    const first = await runExtractionLoop(input);
    allToolCalls.push(...first.toolCallsExecuted);

    let payload: Record<string, unknown>;
    try {
      payload = extractJsonObject(first.content);
    } catch {
      const prose = looksLikeProseSummary(first.content);
      if (prose) {
        return {
          definitions: [],
          toolCallsExecuted: allToolCalls,
          summary: prose,
          errors: [],
        };
      }
      throw new KimiJsonParseError("Structured extraction failed");
    }

    const parsed = parseAssetDefinitions(payload, input.workspaceId);

    if (parsed.length === 0) {
      const prose = looksLikeProseSummary(first.content);
      if (prose) {
        return {
          definitions: [],
          toolCallsExecuted: allToolCalls,
          summary: prose,
          errors: [],
        };
      }
      return {
        definitions: [],
        toolCallsExecuted: allToolCalls,
        errors: ["No asset definitions in model response"],
      };
    }

    let validation = validateDefinitions(parsed, input.workspaceId);

    if (validation.valid.length === 0 && validation.hints.length > 0) {
      const retry = await runExtractionLoop(input, [...validation.errors, ...validation.hints]);
      allToolCalls.push(...retry.toolCallsExecuted);
      const retryPayload = extractJsonObject(retry.content);
      const retryParsed = parseAssetDefinitions(retryPayload, input.workspaceId);
      validation = validateDefinitions(retryParsed, input.workspaceId);
    }

    if (validation.valid.length === 0) {
      errors.push(...validation.errors);
    }

    const summary =
      typeof payload.summary === "string"
        ? payload.summary
        : undefined;

    return {
      definitions: validation.valid,
      toolCallsExecuted: allToolCalls,
      summary,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Structured extraction failed";
    errors.push(message);
    return {
      definitions: [],
      toolCallsExecuted: allToolCalls,
      errors,
    };
  }
}
