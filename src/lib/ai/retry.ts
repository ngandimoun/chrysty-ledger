import type { KimiStreamEvent, KimiUsage } from "@/lib/ai/types";
import { getRetryConfig } from "@/lib/ai/retry-config";

export type RetryOptions = {
  maxAttempts?: number;
  delayMs?: number;
  exponentialBackoff?: boolean;
  onRetry?: (attempt: number, error: unknown) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  if ("status" in error && typeof (error as { status?: unknown }).status === "number") {
    return (error as { status: number }).status;
  }
  return null;
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return null;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return false;
  if (error instanceof Error && error.name === "AbortError") return false;

  const status = getErrorStatus(error);
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  if (status === 400 || status === 401 || status === 403 || status === 404) return false;

  const code = getErrorCode(error);
  if (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "EAI_AGAIN"
  ) {
    return true;
  }

  if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
    return true;
  }

  return false;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const defaults = getRetryConfig();
  const maxAttempts = options.maxAttempts ?? defaults.maxAttempts;
  const delayMs = options.delayMs ?? defaults.retryDelayMs;
  const exponentialBackoff = options.exponentialBackoff ?? false;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxAttempts) {
        throw error;
      }
      options.onRetry?.(attempt, error);
      const waitMs = exponentialBackoff ? delayMs * attempt : delayMs;
      await sleep(waitMs);
    }
  }

  throw lastError;
}

export async function* withStreamRetry(
  fn: () => AsyncGenerator<KimiStreamEvent>,
  options: RetryOptions = {}
): AsyncGenerator<KimiStreamEvent> {
  const defaults = getRetryConfig();
  const maxAttempts = options.maxAttempts ?? defaults.maxAttempts;
  const delayMs = options.delayMs ?? defaults.retryDelayMs;
  const exponentialBackoff = options.exponentialBackoff ?? false;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      for await (const event of fn()) {
        yield event;
      }
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxAttempts) {
        throw error;
      }
      options.onRetry?.(attempt, error);
      yield { type: "reconnecting", attempt: attempt + 1 };
      const waitMs = exponentialBackoff ? delayMs * attempt : delayMs;
      await sleep(waitMs);
    }
  }

  throw lastError;
}

export function normalizeUsage(usage: unknown): KimiUsage | null {
  if (typeof usage !== "object" || usage === null) return null;
  const record = usage as Record<string, unknown>;
  if (
    typeof record.prompt_tokens === "number" &&
    typeof record.completion_tokens === "number" &&
    typeof record.total_tokens === "number"
  ) {
    return {
      prompt_tokens: record.prompt_tokens,
      completion_tokens: record.completion_tokens,
      total_tokens: record.total_tokens,
    };
  }
  return null;
}
