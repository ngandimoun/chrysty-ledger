import { getMoonshotConfig } from "@/lib/ai/config";

export function getRetryConfig() {
  const config = getMoonshotConfig();
  return {
    maxAttempts: config.maxRetries,
    retryDelayMs: config.retryDelayMs,
  };
}
