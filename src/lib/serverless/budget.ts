import "server-only";

import {
  SERVERLESS_TIMEOUT_CODE,
  SERVERLESS_TIMEOUT_MESSAGE,
} from "@/lib/serverless/constants";

const DEFAULT_SERVERLESS_BUDGET_MS = 280_000;
const UNLIMITED_BUDGET_MS = Number.MAX_SAFE_INTEGER;

export { SERVERLESS_TIMEOUT_CODE, SERVERLESS_TIMEOUT_MESSAGE };

function parseBudgetMs(): number {
  const env = process.env.SERVERLESS_BUDGET_MS;
  if (env) {
    const parsed = Number.parseInt(env, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (process.env.VERCEL) return DEFAULT_SERVERLESS_BUDGET_MS;
  return UNLIMITED_BUDGET_MS;
}

export type ServerlessBudget = {
  signal: AbortSignal;
  remainingMs: () => number;
  assertBudget: () => void;
  isTimedOut: () => boolean;
  dispose: () => void;
};

export function createServerlessBudget(parentSignal?: AbortSignal | null): ServerlessBudget {
  const budgetMs = parseBudgetMs();
  const controller = new AbortController();
  const startedAt = Date.now();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onParentAbort = () => {
    if (!controller.signal.aborted) {
      controller.abort(parentSignal?.reason);
    }
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason);
    } else {
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }
  }

  if (budgetMs < UNLIMITED_BUDGET_MS) {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(SERVERLESS_TIMEOUT_CODE));
    }, budgetMs);
  }

  const dispose = () => {
    if (timer) clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
  };

  controller.signal.addEventListener("abort", dispose, { once: true });

  return {
    signal: controller.signal,
    remainingMs: () => Math.max(0, budgetMs - (Date.now() - startedAt)),
    assertBudget: () => {
      if (controller.signal.aborted) {
        throw new Error(timedOut ? SERVERLESS_TIMEOUT_MESSAGE : "Request was cancelled.");
      }
    },
    isTimedOut: () => timedOut,
    dispose,
  };
}

export function isServerlessTimeoutError(error: unknown): boolean {
  if (error instanceof Error && error.message === SERVERLESS_TIMEOUT_CODE) return true;
  return false;
}
