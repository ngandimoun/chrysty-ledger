import { z } from "zod";

import { createJsonCompletion } from "@/lib/ai/response-modes";
import { KIMI_OFFICIAL_FORMULA_SHORT_NAMES } from "@/lib/ai/official-tools";
import type { ChatRequestMode } from "@/lib/chat-types";
import { AGENT_ACTIONS, type ActionPlan, type ActionStep } from "@/lib/agent-actions/types";

const actionStepSchema = z.object({
  action: z.enum(AGENT_ACTIONS),
  inputs: z.record(z.string(), z.unknown()).default({}),
  tools: z.array(z.enum(KIMI_OFFICIAL_FORMULA_SHORT_NAMES)).optional(),
});

const actionPlanSchema = z.object({
  actions: z.array(actionStepSchema).min(1),
  userFacingPhase: z.string().min(1),
  summary: z.string().optional(),
});

const PLANNER_PROMPT = `You are the action planner for Chrysty Ledger workspace agent.
Users may write in ANY language. Output a JSON action plan using ONLY universal actions:

create, read, update, delete, analyze, transform, import, export, search, link

Rules:
- AI creates asset definitions (kind, subtype, title, schema, data) — never UI code.
- Uploaded files → import action first with Kimi tools, then transform to table/document/dashboard as needed.
- Use link to connect derived assets (relation: derived_from, feeds, summary_of, page_of).
- For vague finance setup requests, create a project (kind=project via create) and multiple assets.
- Prefer assets as deliverables; keep summary short.
- On import/transform/analyze steps, include "tools" array selecting Kimi native tools.
- With NO attachments and NO existing assets, requests like "create invoice", "upload receipts", "import spreadsheet", or "analyze my business" MUST use a single conversational create action: { "action": "create", "inputs": { "conversational": true } }. Do NOT create assets until the user provides client details or files.
- Image attachments (PNG/JPG/WebP) and mixed file+image uploads are analyzed via vision chat with correlated insights. Prefer a single conversational/analysis response over import+transform unless the user explicitly requests structured ledger import from a spreadsheet file alone.

Available tools: excel, code_runner, quickjs, date, fetch, convert, rethink, memory

Tool selection guide:
- import + spreadsheets → ["excel", "date"]
- import + PDF/receipts → ["excel", "code_runner", "date"]
- transform → ["code_runner", "excel", "quickjs", "date"]
- analyze numeric data → ["code_runner", "excel", "quickjs"]

Action input examples:
- import: { "useAttachments": true }, tools: ["excel", "date"]
- transform: { "sourceVar": "$prev", "targetKind": "dashboard", "subtype": "cashflow" }, tools: ["code_runner"]
- link: { "fromVar": "$prev", "toVar": "$prev2", "relation": "feeds" }
- search: { "query": "invoices march" }

Respond JSON only:
{
  "actions": [{ "action": "import", "tools": ["excel", "date"], "inputs": { "useAttachments": true } }],
  "userFacingPhase": "Building your workspace…",
  "summary": "optional"
}`;

export type PlannerContext = {
  userInput: string;
  attachmentCount: number;
  attachmentTypes: string[];
  mode: ChatRequestMode;
  assetCount: number;
  assetKinds: string[];
  signal?: AbortSignal;
};

function fallbackPlan(context: PlannerContext): ActionPlan {
  if (context.attachmentCount > 0) {
    return {
      userFacingPhase: "Importing and structuring your files…",
      actions: [
        {
          action: "import",
          tools: ["excel", "date"],
          inputs: { useAttachments: true },
        },
        {
          action: "transform",
          tools: ["code_runner", "excel"],
          inputs: { sourceVar: "$prev", targetKind: "dashboard", subtype: "cashflow" },
        },
      ],
    };
  }

  if (context.mode === "search") {
    return {
      userFacingPhase: "Searching workspace and web…",
      actions: [{ action: "search", inputs: { query: context.userInput } }],
    };
  }

  return {
    userFacingPhase: "Understanding your request…",
    actions: [
      {
        action: "create",
        inputs: {
          kind: "document",
          subtype: "note",
          title: "Assistant note",
          schema: { sections: [{ title: "Response", type: "text" }] },
          data: { sections: [{ title: "Response", body: "" }] },
          conversational: true,
        },
      },
    ],
  };
}

export async function resolveActionPlan(context: PlannerContext): Promise<ActionPlan> {
  try {
    const result = await createJsonCompletion<Record<string, unknown>>({
      messages: [
        { role: "system", content: PLANNER_PROMPT },
        {
          role: "user",
          content: [
            `Message: ${context.userInput}`,
            `Attachments: ${context.attachmentCount} (${context.attachmentTypes.join(", ") || "none"})`,
            `Mode: ${context.mode}`,
            `Existing assets: ${context.assetCount} (${context.assetKinds.join(", ") || "none"})`,
          ].join("\n"),
        },
      ],
      thinking: { type: "disabled" },
      maxTokens: 1024,
      signal: context.signal,
    });
    return actionPlanSchema.parse(result.data) as ActionPlan;
  } catch {
    return fallbackPlan(context);
  }
}

export function resolveVariable(ref: string, variables: Record<string, string>): string | undefined {
  if (!ref.startsWith("$")) return ref;
  return variables[ref] ?? variables[ref.replace("$", "")];
}

export type { ActionStep };
