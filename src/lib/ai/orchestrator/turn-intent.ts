import { referencesPriorTurn } from "@/lib/ai/conversation-context";

export type TurnIntent = "text_only" | "analyze_new" | "create_assets" | "update_asset";

const TEXT_ONLY_PATTERNS = [
  /\bjust explain\b/i,
  /\bno chart\b/i,
  /\bdon'?t save\b/i,
  /\btext only\b/i,
  /\bonly (?:tell|describe)\b/i,
];

const VISUALIZATION_PATTERNS = [
  /\bviz\b/i,
  /\bvisuali[sz]e\b/i,
  /\bchart\b/i,
  /\bgraph\b/i,
  /\bdashboard\b/i,
];

export function userWantsTextOnly(userInput: string): boolean {
  return TEXT_ONLY_PATTERNS.some((pattern) => pattern.test(userInput));
}

export function userWantsVisualization(userInput: string): boolean {
  return VISUALIZATION_PATTERNS.some((pattern) => pattern.test(userInput));
}

const REVISION_PATTERNS = [
  /\bupdate\b/i,
  /\bchange\b/i,
  /\bfix\b/i,
  /\brevise\b/i,
  /\bcorrect\b/i,
  /\badjust\b/i,
  /\bmodify\b/i,
];

const ADD_TO_EXISTING_PATTERNS = [
  /\badd\b.+\bto\b.+\b(table|chart|sheet|dashboard|asset)\b/i,
  /\bappend\b.+\bto\b/i,
  /\binclude\b.+\bin\b.+\b(table|chart|sheet)\b/i,
  /\bmerge\b.+\binto\b/i,
  /\bincorporate\b.+\binto\b/i,
  /\bnew\b.+\b(row|line|entry)\b.+\bto\b/i,
];

const NAMED_ASSET_PATTERNS = [
  /\bdata table\s*\d/i,
  /\bspending by category\b/i,
  /\bpayment status\b/i,
  /\bspending table\b/i,
  /\bopen\b.+\b(table|chart|sheet)\b/i,
];

const TOPIC_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bcash\s*flow\b/i, label: "Cash flow" },
  { pattern: /\bcashflow\b/i, label: "Cash flow" },
  { pattern: /\binflow\b/i, label: "Cash inflow" },
  { pattern: /\boutflow\b/i, label: "Cash outflow" },
  { pattern: /\bliquidity\b/i, label: "Liquidity" },
  { pattern: /\brevenue\b/i, label: "Revenue" },
  { pattern: /\bprofit\b/i, label: "Profit" },
  { pattern: /\bexpense\b/i, label: "Expenses" },
  { pattern: /\bspending\b/i, label: "Spending" },
];

export function extractPromptTopic(userInput: string): string | null {
  for (const { pattern, label } of TOPIC_PATTERNS) {
    if (pattern.test(userInput)) return label;
  }
  return null;
}

export function userRequestsAssetRevision(userInput: string): boolean {
  if (REVISION_PATTERNS.some((pattern) => pattern.test(userInput))) {
    return true;
  }
  if (ADD_TO_EXISTING_PATTERNS.some((pattern) => pattern.test(userInput))) {
    return true;
  }
  if (
    referencesPriorTurn(userInput) &&
    /\b(table|chart|sheet|dashboard|asset)\b/i.test(userInput) &&
    /\b(add|append|update|fix|change)\b/i.test(userInput)
  ) {
    return true;
  }
  return NAMED_ASSET_PATTERNS.some((pattern) => pattern.test(userInput));
}

export function resolveTurnIntent(input: {
  userInput: string;
  attachmentCount: number;
  openAssetId?: string | null;
  referencedAssetIds?: string[];
}): TurnIntent {
  if (userWantsTextOnly(input.userInput)) {
    return "text_only";
  }

  const wantsRevision = userRequestsAssetRevision(input.userInput);
  const hasReferencedTarget = (input.referencedAssetIds ?? []).filter(Boolean).length === 1;
  if (
    wantsRevision &&
    (input.openAssetId ||
      NAMED_ASSET_PATTERNS.some((p) => p.test(input.userInput)) ||
      hasReferencedTarget)
  ) {
    return "update_asset";
  }

  if (wantsRevision && input.openAssetId) {
    return "update_asset";
  }

  if (input.attachmentCount > 0) {
    if (userWantsVisualization(input.userInput) || extractPromptTopic(input.userInput)) {
      return "create_assets";
    }
    return "analyze_new";
  }

  if (userWantsVisualization(input.userInput)) {
    return "create_assets";
  }

  return "analyze_new";
}

export function resolveChatTargetAssetId(input: {
  userInput: string;
  attachmentCount: number;
  openAssetId?: string | null;
  referencedAssetIds?: string[];
}): string | undefined {
  const intent = resolveTurnIntent(input);
  if (intent !== "update_asset") return undefined;

  const openAssetId = input.openAssetId?.trim();
  if (openAssetId) return openAssetId;

  const referenced = (input.referencedAssetIds ?? []).filter(Boolean);
  if (referenced.length === 1) {
    return referenced[0];
  }

  return undefined;
}

export function introducesNewTopic(userInput: string, priorText: string | null): boolean {
  const topic = extractPromptTopic(userInput);
  if (!topic) return false;
  if (!priorText?.trim()) return true;
  return !priorText.toLowerCase().includes(topic.toLowerCase());
}
