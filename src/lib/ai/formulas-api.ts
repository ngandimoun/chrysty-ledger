import type OpenAI from "openai";

import { getMoonshotConfig, requireMoonshotConfig } from "@/lib/ai/config";
import { withRetry } from "@/lib/ai/retry";
import type { FormulaFiberResult } from "@/lib/ai/types";

type FormulaToolsResponse = {
  object?: string;
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
};

type FormulaFiberResponse = {
  id?: string;
  object?: string;
  status?: string;
  error?: string;
  context?: {
    input?: string;
    output?: string;
    encrypted_output?: string;
    error?: string;
  };
};

function getFormulaHeaders(): HeadersInit {
  const config = requireMoonshotConfig();
  return {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
}

function buildFormulaUrl(path: string): string {
  const config = getMoonshotConfig();
  const base = config.baseURL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export class FormulaToolsFetchError extends Error {
  readonly formulaUri: string;
  readonly status: number;

  constructor(formulaUri: string, status: number, body: string) {
    super(`Failed to load formula tools for "${formulaUri}" (${status}): ${body}`);
    this.name = "FormulaToolsFetchError";
    this.formulaUri = formulaUri;
    this.status = status;
  }
}

export function isFormulaUnavailableError(error: unknown): boolean {
  return (
    error instanceof FormulaToolsFetchError &&
    (error.status === 404 || error.status === 403)
  );
}

export async function fetchFormulaTools(
  formulaUri: string
): Promise<OpenAI.Chat.Completions.ChatCompletionTool[]> {
  return withRetry(async () => {
    const response = await fetch(buildFormulaUrl(`/formulas/${formulaUri}/tools`), {
      method: "GET",
      headers: getFormulaHeaders(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new FormulaToolsFetchError(formulaUri, response.status, body);
    }

    const payload = (await response.json()) as FormulaToolsResponse;
    return payload.tools ?? [];
  });
}

export async function callFormulaFiber(
  formulaUri: string,
  name: string,
  args: Record<string, unknown>
): Promise<FormulaFiberResult> {
  return withRetry(async () => {
    const config = getMoonshotConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.formulaFiberTimeoutMs);

    try {
      const response = await fetch(buildFormulaUrl(`/formulas/${formulaUri}/fibers`), {
        method: "POST",
        headers: getFormulaHeaders(),
        body: JSON.stringify({
          name,
          arguments: JSON.stringify(args),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          content: "",
          error: `Fiber request failed (${response.status}): ${body}`,
        };
      }

      const fiber = (await response.json()) as FormulaFiberResponse;

      if (fiber.status === "succeeded") {
        const content = fiber.context?.output ?? fiber.context?.encrypted_output ?? "";
        return {
          success: true,
          content,
          error: null,
        };
      }

      const error =
        fiber.error ??
        fiber.context?.error ??
        (fiber.context?.output?.startsWith("Error") ? fiber.context.output : null) ??
        `Formula fiber failed with status "${fiber.status ?? "unknown"}".`;

      return {
        success: false,
        content: fiber.context?.output ?? fiber.context?.encrypted_output ?? "",
        error,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          content: "",
          error: `Formula fiber timed out after ${config.formulaFiberTimeoutMs}ms.`,
        };
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  });
}
