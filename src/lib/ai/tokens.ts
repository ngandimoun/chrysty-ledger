import { requireMoonshotConfig } from "@/lib/ai/config";
import { withRetry } from "@/lib/ai/retry";
import type { KimiMessage } from "@/lib/ai/types";

type EstimateTokenCountOptions = {
  model?: string;
  messages: KimiMessage[];
};

type EstimateTokenCountResponse = {
  data?: {
    total_tokens?: number;
  };
};

export async function estimateTokenCount(options: EstimateTokenCountOptions): Promise<number> {
  const config = requireMoonshotConfig();

  return withRetry(async () => {
    const response = await fetch(`${config.baseURL}/tokenizers/estimate-token-count`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model ?? config.model,
        messages: options.messages,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token estimate failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as EstimateTokenCountResponse;
    const total = payload.data?.total_tokens;
    if (typeof total !== "number") {
      throw new Error("Token estimate response missing total_tokens");
    }
    return total;
  });
}

export async function estimateCompletionTokens(text: string, model?: string): Promise<number> {
  return estimateTokenCount({
    model,
    messages: [{ role: "user", content: text }],
  });
}
