import type { KimiMessage } from "@/lib/ai/types";
import { AI_KIND_TEMPLATES } from "@/lib/assets/ai-templates";

export const STRUCTURED_ASSET_SYSTEM_PROMPT = `You are the structured data layer for Chrysty Ledger.
Output ONLY valid JSON. Never output React, AG Grid, Recharts, or UI code.

Your job is to produce asset definitions the platform will validate and render.

Each asset definition shape:
{
  "kind": "table" | "chart" | "dashboard" | "document" | "file",
  "subtype": "optional string e.g. transactions, invoice, cashflow",
  "title": "human title",
  "schema": { ... structure only ... },
  "data": { ... values only ... }
}

Rules:
- Discover columns from the source document. Never use a fixed column list.
- For receipts/invoices: infer columns (date, vendor, amount, tax, category, etc.) from what you read.
- For Excel/CSV: use the excel tool to understand sheets, headers, and row data.
- For calculations (totals, trends, YoY): use code_runner or quickjs — do not guess numbers.
- For dashboards: schema.widgets with type metric or viz; viz widgets use intent (compare_categories, show_over_time, etc.) — never raw chart props.
- For charts: schema.intent must be one of compare_categories, show_over_time, show_distribution, show_part_of_whole, compare_metrics, show_revenue_over_time. data.series MUST be an array of { label: string, value: number }. Never use points, xKey, yKey, or raw chart props.
- For documents: schema.sections + data.sections with body text.
- Multiple logical tables from one workbook → return { "assets": [ {...}, {...} ] }
- Single asset → return { "assets": [ {...} ] } or the asset object at root with an "assets" array.

Kind templates (structure hints):
${JSON.stringify(AI_KIND_TEMPLATES, null, 2)}

Use Kimi tools proactively before producing final JSON when files or math are involved.`;

export function buildStructuredExtractionMessages(input: {
  userInput: string;
  fileSystemMessages?: KimiMessage[];
  sourceContext?: Record<string, unknown>;
  targetKind?: string;
  subtype?: string;
  mode: "import" | "transform" | "analyze";
  fromChatAnalysis?: boolean;
  retryHints?: string[];
}): KimiMessage[] {
  const messages: KimiMessage[] = [
    { role: "system", content: STRUCTURED_ASSET_SYSTEM_PROMPT },
    ...(input.fileSystemMessages ?? []),
  ];

  if (input.mode === "transform" && input.targetKind) {
    messages.push({
      role: "system",
      content: `Transform task: produce kind="${input.targetKind}"${input.subtype ? ` subtype="${input.subtype}"` : ""}.`,
    });
  }

  if (input.mode === "analyze") {
    messages.push({
      role: "system",
      content: input.fromChatAnalysis
        ? "Analyze task: convert the assistant analysis text below into chart or dashboard JSON. Charts MUST use data.series as [{ label, value }]. Prefer compare_categories for category breakdowns and show_over_time for date trends. Use titles that match the user's requested topic. Never use bare section labels like Payment status or Spending by category without a topic prefix."
        : "Analyze task: produce a chart, dashboard, or document asset with insights from the uploaded source. Charts MUST use data.series as [{ label, value }]. Use code_runner for aggregations. Name assets after the user's topic (e.g. Cash flow summary), not generic labels like Data table 1, Payment status, or Spending by category.",
    });
  }

  const userParts = [input.userInput];
  if (input.sourceContext) {
    userParts.push(`Source context:\n${JSON.stringify(input.sourceContext)}`);
  }
  if (input.retryHints?.length) {
    userParts.push(`Fix these validation errors:\n${input.retryHints.join("\n")}`);
  }

  messages.push({ role: "user", content: userParts.join("\n\n") });
  return messages;
}
