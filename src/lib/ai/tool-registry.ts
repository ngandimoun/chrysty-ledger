import type OpenAI from "openai";

import {
  fetchFormulaTools,
  isFormulaUnavailableError,
} from "@/lib/ai/formulas-api";
import {
  KIMI_BUILTIN_WEB_SEARCH_TOOL,
  type KimiOfficialFormulaShortName,
  parseEnabledOfficialTools,
  resolveLedgerFormulaUris,
  resolveWebSearchMode,
} from "@/lib/ai/official-tools";
import type { MoonshotWebSearchMode, OfficialToolRegistry } from "@/lib/ai/types";

const REGISTRY_CACHE_TTL_MS = 5 * 60 * 1000;

type RegistryCacheEntry = {
  expiresAt: number;
  registry: OfficialToolRegistry;
};

const registryCache = new Map<string, RegistryCacheEntry>();

function getFunctionName(tool: OpenAI.Chat.Completions.ChatCompletionTool): string | null {
  if (tool.type !== "function") return null;
  return tool.function.name ?? null;
}

function buildRegistryCacheKey(
  formulaUris: string[],
  webSearchMode: MoonshotWebSearchMode
): string {
  return JSON.stringify({
    formulaUris: [...formulaUris].sort(),
    webSearchMode,
  });
}

export type LoadOfficialToolRegistryOptions = {
  formulaUris?: string[];
  enabledTools?: KimiOfficialFormulaShortName[];
  webSearchMode?: MoonshotWebSearchMode;
  skipCache?: boolean;
};

export async function loadOfficialToolRegistry(
  options: LoadOfficialToolRegistryOptions = {}
): Promise<OfficialToolRegistry> {
  const webSearchMode = options.webSearchMode ?? resolveWebSearchMode();
  const formulaUris =
    options.formulaUris ??
    resolveLedgerFormulaUris({
      enabledTools: options.enabledTools ?? parseEnabledOfficialTools(),
      webSearchMode,
    });

  if (!options.skipCache) {
    const cacheKey = buildRegistryCacheKey(formulaUris, webSearchMode);
    const cached = registryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.registry;
    }
  }

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];
  const toolToUri = new Map<string, string>();
  const loadedUris: string[] = [];

  if (webSearchMode === "builtin") {
    tools.push(KIMI_BUILTIN_WEB_SEARCH_TOOL);
  }

  const results = await Promise.allSettled(
    formulaUris.map(async (uri) => ({ uri, formulaTools: await fetchFormulaTools(uri) }))
  );

  for (const result of results) {
    if (result.status === "rejected") {
      const error = result.reason;
      if (isFormulaUnavailableError(error)) {
        console.warn(`[tool-registry] Skipping unavailable formula: ${error.formulaUri}`);
        continue;
      }
      throw error;
    }

    const { uri, formulaTools } = result.value;
    loadedUris.push(uri);

    for (const tool of formulaTools) {
      const functionName = getFunctionName(tool);
      if (!functionName) {
        continue;
      }

      if (toolToUri.has(functionName)) {
        throw new Error(
          `Duplicate official tool name "${functionName}" between ${toolToUri.get(functionName)} and ${uri}.`
        );
      }

      if (webSearchMode === "builtin" && functionName === "web_search") {
        continue;
      }

      tools.push(tool);
      toolToUri.set(functionName, uri);
    }
  }

  const registry: OfficialToolRegistry = {
    tools,
    toolToUri,
    webSearchMode,
    formulaUris: loadedUris,
  };

  const cacheKey = buildRegistryCacheKey(formulaUris, webSearchMode);
  registryCache.set(cacheKey, {
    expiresAt: Date.now() + REGISTRY_CACHE_TTL_MS,
    registry,
  });

  return registry;
}

export function getFormulaUriForTool(
  registry: OfficialToolRegistry,
  functionName: string
): string | null {
  return registry.toolToUri.get(functionName) ?? null;
}

export function listOfficialFormulaNames(): KimiOfficialFormulaShortName[] {
  return parseEnabledOfficialTools();
}
