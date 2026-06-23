import { z } from "zod";

import { createJsonCompletion } from "@/lib/ai/response-modes";
import type { ChatRequestMode } from "@/lib/chat-types";
import {
  applyModeBias,
  getToolsForRoute,
} from "@/lib/ai/orchestrator/tool-profiles";
import {
  LEDGER_ROUTES,
  type LedgerRoute,
  type LedgerRoutePlan,
  type LedgerRoutingContext,
} from "@/lib/ai/orchestrator/ledger-route-types";

const routePlanSchema = z.object({
  route: z.enum(LEDGER_ROUTES),
  confidence: z.number().min(0).max(1),
  thinking: z.boolean(),
  workflowId: z.enum(["bulkImport", "expenseAnalysis"]).nullable().optional(),
  userFacingPhase: z.string().min(1),
});

const ROUTER_SYSTEM_PROMPT = `You are the routing layer for Chrysty Ledger, an AI finance workspace.
Classify the user's intent into exactly one route. Users may write in ANY language or style.

Routes:
- chat: greetings, general questions, simple bookkeeping advice, casual conversation
- search: needs current web facts (tax rates, regulations, exchange rates, vendor info)
- extract: user uploaded files to import transactions, receipts, or bank statements
- analyze: user wants expense analysis, trends, or reports on existing workspace data
- bulk_import: multiple files to import at once into the workspace
- create_asset: user wants an invoice, dashboard, report, or structured financial document created

Rules:
- If attachments are present and the user wants data imported, prefer extract (single file) or bulk_import (multiple files).
- If the workspace has assets and the user asks for analysis/trends/summary, prefer analyze.
- If unsure, prefer chat.
- userFacingPhase must be a short English status line for the UI (e.g. "Understanding your request…").

Respond with JSON only:
{
  "route": "chat",
  "confidence": 0.9,
  "thinking": false,
  "workflowId": null,
  "userFacingPhase": "Understanding your request…"
}`;

function buildRoutingUserMessage(context: LedgerRoutingContext): string {
  return [
    `Message: ${context.userInput}`,
    `Attachments: ${context.attachmentCount} (${context.attachmentTypes.join(", ") || "none"})`,
    `UI mode: ${context.mode}`,
    `Workspace assets: ${context.assetCount} (${context.assetCategories.join(", ") || "none"})`,
    `Workflows available: ${context.mastraEnabled ? "yes" : "no"}`,
  ].join("\n");
}

function fallbackPlan(context: LedgerRoutingContext): LedgerRoutePlan {
  if (context.attachmentCount > 1) {
    return {
      route: context.mastraEnabled ? "bulk_import" : "extract",
      confidence: 0.7,
      tools: getToolsForRoute(context.mastraEnabled ? "bulk_import" : "extract"),
      thinking: false,
      workflowId: context.mastraEnabled ? "bulkImport" : undefined,
      userFacingPhase: "Importing your files…",
    };
  }

  if (context.attachmentCount > 0) {
    return {
      route: "extract",
      confidence: 0.8,
      tools: getToolsForRoute("extract"),
      thinking: false,
      userFacingPhase: "Extracting transactions from your documents…",
    };
  }

  if (context.mode === "search") {
    return {
      route: "search",
      confidence: 0.9,
      tools: getToolsForRoute("search"),
      thinking: false,
      userFacingPhase: "Searching for current information…",
    };
  }

  return {
    route: "chat",
    confidence: 0.6,
    tools: getToolsForRoute("chat"),
    thinking: context.mode === "think",
    userFacingPhase: "Understanding your request…",
  };
}

function normalizePlan(
  parsed: z.infer<typeof routePlanSchema>,
  context: LedgerRoutingContext
): LedgerRoutePlan {
  let route = parsed.route;

  if (
    (route === "analyze" || route === "bulk_import") &&
    !context.mastraEnabled
  ) {
    route = route === "bulk_import" && context.attachmentCount > 0 ? "extract" : "chat";
  }

  if (route === "bulk_import" && context.attachmentCount <= 1) {
    route = context.attachmentCount > 0 ? "extract" : "chat";
  }

  if (route === "extract" && context.attachmentCount === 0) {
    route = "chat";
  }

  return {
    route,
    confidence: parsed.confidence,
    tools: getToolsForRoute(route),
    thinking: parsed.thinking,
    workflowId:
      parsed.workflowId && (route === "analyze" || route === "bulk_import")
        ? parsed.workflowId
        : route === "analyze"
          ? "expenseAnalysis"
          : route === "bulk_import"
            ? "bulkImport"
            : undefined,
    userFacingPhase: parsed.userFacingPhase,
  };
}

export async function resolveLedgerRoutePlan(input: {
  context: LedgerRoutingContext;
  signal?: AbortSignal;
}): Promise<LedgerRoutePlan> {
  const { context, signal } = input;

  try {
    const result = await createJsonCompletion<Record<string, unknown>>({
      messages: [
        { role: "system", content: ROUTER_SYSTEM_PROMPT },
        { role: "user", content: buildRoutingUserMessage(context) },
      ],
      thinking: { type: "disabled" },
      maxTokens: 256,
      signal,
    });

    const parsed = routePlanSchema.parse(result.data);
    const plan = normalizePlan(parsed, context);
    return applyModeBias(plan, context.mode);
  } catch {
    const plan = fallbackPlan(context);
    return applyModeBias(plan, context.mode);
  }
}

export function buildRoutingContext(input: {
  userInput: string;
  attachmentCount: number;
  attachmentTypes: string[];
  mode: ChatRequestMode;
  assetCount?: number;
  assetCategories?: string[];
  mastraEnabled: boolean;
}): LedgerRoutingContext {
  return {
    userInput: input.userInput,
    attachmentCount: input.attachmentCount,
    attachmentTypes: input.attachmentTypes,
    mode: input.mode,
    assetCount: input.assetCount ?? 0,
    assetCategories: input.assetCategories ?? [],
    mastraEnabled: input.mastraEnabled,
  };
}

export type { LedgerRoute };
