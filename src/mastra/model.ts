import "server-only";

import type { MastraModelConfig } from "@mastra/core/llm";
import { getMoonshotConfig, isMoonshotConfigured } from "@/lib/ai/config";
import { KIMI_K26_MODEL } from "@/lib/ai/kimi-k26";

export function getLedgerModel(): MastraModelConfig {
  const config = getMoonshotConfig();
  return {
    providerId: "moonshot",
    modelId: config.model || KIMI_K26_MODEL,
    url: config.baseURL,
    apiKey: config.apiKey,
  };
}

export function getLedgerMemoryModel(): MastraModelConfig {
  if (process.env.OPENAI_API_KEY) {
    return "openai/gpt-4o-mini";
  }
  return getLedgerModel();
}

export function isLedgerAgentModelConfigured(): boolean {
  return isMoonshotConfigured();
}
