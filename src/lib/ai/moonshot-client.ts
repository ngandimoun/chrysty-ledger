import OpenAI from "openai";

import { requireMoonshotConfig } from "@/lib/ai/config";

let cachedClient: OpenAI | null = null;

export function createMoonshotClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const config = requireMoonshotConfig();
  cachedClient = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    maxRetries: 0,
  });

  return cachedClient;
}

export function resetMoonshotClientForTests(): void {
  cachedClient = null;
}
