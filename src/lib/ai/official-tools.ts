import type OpenAI from "openai";

import { getMoonshotConfig } from "@/lib/ai/config";
import type { MoonshotWebSearchMode } from "@/lib/ai/types";

export const KIMI_BUILTIN_WEB_SEARCH_NAME = "$web_search";

export const KIMI_BUILTIN_WEB_SEARCH_TOOL = {
  type: "builtin_function",
  function: {
    name: KIMI_BUILTIN_WEB_SEARCH_NAME,
  },
} as unknown as OpenAI.Chat.Completions.ChatCompletionTool;

export const KIMI_OFFICIAL_FORMULA_SHORT_NAMES = [
  "convert",
  "web-search",
  "rethink",
  "random-choice",
  "mew",
  "memory",
  "excel",
  "date",
  "base64",
  "fetch",
  "quickjs",
  "code_runner",
] as const;

export type KimiOfficialFormulaShortName = (typeof KIMI_OFFICIAL_FORMULA_SHORT_NAMES)[number];

export const KIMI_OFFICIAL_FORMULA_URIS: Record<KimiOfficialFormulaShortName, string> = {
  convert: "moonshot/convert:latest",
  "web-search": "moonshot/web-search:latest",
  rethink: "moonshot/rethink:latest",
  "random-choice": "moonshot/random-choice:latest",
  mew: "moonshot/mew:latest",
  memory: "moonshot/memory:latest",
  excel: "moonshot/excel:latest",
  date: "moonshot/date:latest",
  base64: "moonshot/base64:latest",
  fetch: "moonshot/fetch:latest",
  quickjs: "moonshot/quickjs:latest",
  code_runner: "moonshot/code-runner:latest",
};

const FORMULA_SHORT_NAME_ALIASES: Record<string, KimiOfficialFormulaShortName> = {
  "code-runner": "code_runner",
};

export const LEDGER_OFFICIAL_FORMULA_URIS = Object.values(KIMI_OFFICIAL_FORMULA_URIS);

export function normalizeFormulaUri(nameOrUri: string): string {
  const trimmed = nameOrUri.trim();
  if (!trimmed) {
    throw new Error("Formula URI or name is required.");
  }

  if (trimmed.includes("/")) {
    return trimmed.includes(":") ? trimmed : `${trimmed}:latest`;
  }

  const aliasKey = FORMULA_SHORT_NAME_ALIASES[trimmed] ?? trimmed;
  const normalizedName = aliasKey as KimiOfficialFormulaShortName;
  const uri = KIMI_OFFICIAL_FORMULA_URIS[normalizedName];
  if (!uri) {
    throw new Error(`Unknown Kimi official formula: "${trimmed}".`);
  }
  return uri;
}

function resolveFormulaShortName(part: string): KimiOfficialFormulaShortName {
  const stripped = part.replace(/^moonshot\//, "").replace(/:latest$/, "");
  const key = (FORMULA_SHORT_NAME_ALIASES[stripped] ?? stripped) as KimiOfficialFormulaShortName;
  if (!KIMI_OFFICIAL_FORMULA_URIS[key]) {
    throw new Error(`Unknown MOONSHOT_OFFICIAL_TOOLS entry: "${part}".`);
  }
  return key;
}

export function resolveWebSearchMode(value?: string): MoonshotWebSearchMode {
  const normalized = (value ?? process.env.MOONSHOT_WEB_SEARCH_MODE ?? "builtin")
    .trim()
    .toLowerCase();

  if (normalized === "formula" || normalized === "off") {
    return normalized;
  }
  return "builtin";
}

export function parseEnabledOfficialTools(value?: string): KimiOfficialFormulaShortName[] {
  const raw = value ?? process.env.MOONSHOT_OFFICIAL_TOOLS;
  if (!raw?.trim()) {
    return [...KIMI_OFFICIAL_FORMULA_SHORT_NAMES];
  }

  const enabled = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => resolveFormulaShortName(part));

  return [...new Set(enabled)];
}

export function resolveLedgerFormulaUris(options?: {
  enabledTools?: KimiOfficialFormulaShortName[];
  webSearchMode?: MoonshotWebSearchMode;
}): string[] {
  const config = getMoonshotConfig();
  const webSearchMode = options?.webSearchMode ?? config.webSearchMode;
  const enabledTools = options?.enabledTools ?? parseEnabledOfficialTools(config.officialTools);

  const uris = enabledTools
    .filter((name) => {
      if (name === "web-search" && webSearchMode !== "formula") {
        return false;
      }
      return true;
    })
    .map((name) => KIMI_OFFICIAL_FORMULA_URIS[name]);

  return [...new Set(uris)];
}
