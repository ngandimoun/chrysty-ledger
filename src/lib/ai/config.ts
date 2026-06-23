import { DEFAULT_MAX_TOKENS, KIMI_K26_MODEL } from "@/lib/ai/kimi-k26";
import type { MoonshotWebSearchMode } from "@/lib/ai/types";

const DEFAULT_BASE_URL = "https://api.moonshot.ai/v1";
const DEFAULT_MAX_HISTORY_MESSAGES = 20;
const DEFAULT_VISION_INLINE_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_FILE_READY_TIMEOUT_MS = 90_000;
const DEFAULT_BATCH_POLL_INTERVAL_MS = 10_000;
const DEFAULT_BATCH_COMPLETION_WINDOW = "24h";
const DEFAULT_TOOL_LOOP_MAX_ROUNDS = 6;
const DEFAULT_FORMULA_FIBER_TIMEOUT_MS = 45_000;
export const MOONSHOT_MAX_FILE_BYTES = 100 * 1024 * 1024;

export type { MoonshotWebSearchMode } from "@/lib/ai/types";

export type MoonshotConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
  maxHistoryMessages: number;
  visionInlineMaxBytes: number;
  maxRetries: number;
  retryDelayMs: number;
  autoDeleteFiles: boolean;
  maxFileBytes: number;
  fileReadyTimeoutMs: number;
  batchPollIntervalMs: number;
  batchCompletionWindow: string;
  batchMaxTokens: number;
  webSearchMode: MoonshotWebSearchMode;
  officialTools: string;
  toolLoopMaxRounds: number;
  formulaFiberTimeoutMs: number;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
}

function parseWebSearchMode(value: string | undefined): MoonshotWebSearchMode {
  const normalized = (value ?? "builtin").trim().toLowerCase();
  if (normalized === "formula" || normalized === "off") return normalized;
  return "builtin";
}

export function getMoonshotConfig(): MoonshotConfig {
  return {
    apiKey: process.env.MOONSHOT_API_KEY ?? "",
    baseURL: process.env.MOONSHOT_BASE_URL ?? DEFAULT_BASE_URL,
    model: process.env.MOONSHOT_MODEL ?? KIMI_K26_MODEL,
    maxHistoryMessages: parsePositiveInt(
      process.env.MOONSHOT_MAX_HISTORY_MESSAGES,
      DEFAULT_MAX_HISTORY_MESSAGES
    ),
    visionInlineMaxBytes: parsePositiveInt(
      process.env.MOONSHOT_VISION_INLINE_MAX_BYTES,
      DEFAULT_VISION_INLINE_MAX_BYTES
    ),
    maxRetries: parsePositiveInt(process.env.MOONSHOT_MAX_RETRIES, DEFAULT_MAX_RETRIES),
    retryDelayMs: parsePositiveInt(process.env.MOONSHOT_RETRY_DELAY_MS, DEFAULT_RETRY_DELAY_MS),
    autoDeleteFiles: parseBoolean(process.env.MOONSHOT_AUTO_DELETE_FILES, true),
    maxFileBytes: parsePositiveInt(
      process.env.MOONSHOT_MAX_FILE_BYTES,
      MOONSHOT_MAX_FILE_BYTES
    ),
    fileReadyTimeoutMs: parsePositiveInt(
      process.env.MOONSHOT_FILE_READY_TIMEOUT_MS,
      DEFAULT_FILE_READY_TIMEOUT_MS
    ),
    batchPollIntervalMs: parsePositiveInt(
      process.env.MOONSHOT_BATCH_POLL_INTERVAL_MS,
      DEFAULT_BATCH_POLL_INTERVAL_MS
    ),
    batchCompletionWindow:
      process.env.MOONSHOT_BATCH_COMPLETION_WINDOW?.trim() || DEFAULT_BATCH_COMPLETION_WINDOW,
    batchMaxTokens: parsePositiveInt(
      process.env.MOONSHOT_BATCH_MAX_TOKENS,
      DEFAULT_MAX_TOKENS
    ),
    webSearchMode: parseWebSearchMode(process.env.MOONSHOT_WEB_SEARCH_MODE),
    officialTools: process.env.MOONSHOT_OFFICIAL_TOOLS?.trim() ?? "",
    toolLoopMaxRounds: parsePositiveInt(
      process.env.MOONSHOT_TOOL_LOOP_MAX_ROUNDS,
      DEFAULT_TOOL_LOOP_MAX_ROUNDS
    ),
    formulaFiberTimeoutMs: parsePositiveInt(
      process.env.MOONSHOT_FORMULA_FIBER_TIMEOUT_MS,
      DEFAULT_FORMULA_FIBER_TIMEOUT_MS
    ),
  };
}

export function isMoonshotConfigured(): boolean {
  return Boolean(getMoonshotConfig().apiKey);
}

export function requireMoonshotConfig(): MoonshotConfig {
  const config = getMoonshotConfig();
  if (!config.apiKey) {
    throw new Error("MOONSHOT_API_KEY is not configured");
  }
  return config;
}
