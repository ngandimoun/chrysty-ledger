import {
  hasParseableNumericTables,
  sanitizeAnalysisTextForParsing,
} from "@/lib/ai/orchestrator/chat-analysis-assets";
import {
  resolveTurnIntent,
  userRequestsAssetRevision,
  userWantsTextOnly,
  userWantsVisualization,
} from "@/lib/ai/orchestrator/turn-intent";

const INSIGHT_KEYWORDS = [
  "spending",
  "spend",
  "client",
  "customer",
  "revenue",
  "compare",
  "chart",
  "viz",
  "visual",
  "dashboard",
  "breakdown",
  "trend",
  "invoice",
  "receipt",
  "total",
  "expense",
  "profit",
  "margin",
  "cash flow",
  "cashflow",
  "inflow",
  "outflow",
  "liquidity",
];

export { userWantsTextOnly, userWantsVisualization } from "@/lib/ai/orchestrator/turn-intent";

export function hasInsightKeywords(...texts: string[]): boolean {
  const combined = texts.join(" ").toLowerCase();
  return INSIGHT_KEYWORDS.some((keyword) => combined.includes(keyword));
}

export function shouldAttemptAssetFromTurn(input: {
  userInput: string;
  chatText: string;
  resolvedAnalysisText?: string;
  attachmentCount: number;
  correlationSummary?: string | null;
}): boolean {
  const intent = resolveTurnIntent({
    userInput: input.userInput,
    attachmentCount: input.attachmentCount,
  });

  if (intent === "text_only") {
    return false;
  }

  if (intent === "create_assets" || intent === "update_asset") {
    return true;
  }

  if (input.attachmentCount > 0) {
    return true;
  }

  if (input.correlationSummary?.trim()) {
    return true;
  }

  const analysisText = sanitizeAnalysisTextForParsing(
    input.resolvedAnalysisText ?? input.chatText
  );
  if (hasParseableNumericTables(analysisText)) {
    return true;
  }

  if (userWantsVisualization(input.userInput)) {
    return true;
  }

  return hasInsightKeywords(input.userInput, input.chatText);
}

export function shouldUpdateExistingAsset(input: {
  userInput: string;
  recentAssetId?: string | null;
  targetAssetId?: string | null;
  attachmentCount?: number;
}): boolean {
  const intent = resolveTurnIntent({
    userInput: input.userInput,
    attachmentCount: input.attachmentCount ?? 0,
    openAssetId: input.targetAssetId,
  });

  if (intent !== "update_asset") {
    return false;
  }

  if (!userRequestsAssetRevision(input.userInput)) {
    return false;
  }

  return Boolean(input.targetAssetId ?? input.recentAssetId);
}
