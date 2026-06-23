import { limitContextTokens } from "@/lib/agent/ledger-guardrails";
import type { ChatMessage } from "@/lib/chat-types";
import type { LedgerWorkingMemory } from "@/lib/schemas/ledger-working-memory";
import type { LedgerScope } from "@/lib/ledger/scope";
import { listMessages } from "@/lib/ledger/messages";

const PRIOR_TURN_PATTERNS = [
  /\bthis\b/i,
  /\bthat\b/i,
  /\bthe above\b/i,
  /\bfrom before\b/i,
  /\bearlier\b/i,
  /\bprevious\b/i,
  /\bsame\s+(?:expense|file|sheet|guest|client|data|chart|report|image)\b/i,
  /\bthose\s+(?:expenses|numbers|totals)\b/i,
  /\bthe\s+(?:expense|data|analysis|breakdown|chart|report)\b/i,
];

const CANVAS_CONTINUITY_RULE =
  "Charts and data tables are saved automatically to the workspace canvas. Keep chat replies brief (insights and next steps only). Never draw ASCII bar charts, block characters (█ ░), or text gauges in chat. If prior analysis or attachments are listed below, never ask the user to re-upload or paste data again.";

export function getLastAssistantText(history: ChatMessage[]): string | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message?.role === "assistant" && message.type === "text" && message.content.trim()) {
      return message.content.trim();
    }
  }
  return null;
}

export function getLastUserMessageWithFiles(
  history: ChatMessage[]
): Extract<ChatMessage, { role: "user"; type: "text" }> | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (
      message?.role === "user" &&
      message.type === "text" &&
      Array.isArray(message.files) &&
      message.files.length > 0
    ) {
      return message;
    }
  }
  return null;
}

export function referencesPriorTurn(userInput: string): boolean {
  return PRIOR_TURN_PATTERNS.some((pattern) => pattern.test(userInput));
}

export async function resolveAppHistory(
  scope: LedgerScope,
  workspaceId: string,
  clientHistory: ChatMessage[]
): Promise<ChatMessage[]> {
  try {
    const stored = await listMessages(scope, workspaceId);
    if (stored.length === 0) return clientHistory;

    const byId = new Map<string, ChatMessage>();
    for (const message of stored) {
      byId.set(message.id, message);
    }
    for (const message of clientHistory) {
      byId.set(message.id, message);
    }

    return [...byId.values()].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  } catch {
    return clientHistory;
  }
}

export function buildFollowUpContext(input: {
  appHistory: ChatMessage[];
  userInput: string;
  memoryRecord?: LedgerWorkingMemory | null;
}): string | null {
  if (!referencesPriorTurn(input.userInput)) {
    return null;
  }

  const priorAnalysis = getLastAssistantText(input.appHistory);
  const priorUserWithFiles = getLastUserMessageWithFiles(input.appHistory);
  const memorySummary = input.memoryRecord?.lastTurn?.summary;
  const memoryAttachments = input.memoryRecord?.lastTurn?.attachmentNames;

  const parts: string[] = [
    `The user is continuing a prior conversation turn. Resolve references like "this", "that", or "the expense" from the context below. ${CANVAS_CONTINUITY_RULE}`,
  ];

  if (priorUserWithFiles?.files?.length) {
    const names = priorUserWithFiles.files.map((file) => file.name).join(", ");
    parts.push(`Prior attachments in this thread: ${priorUserWithFiles.files.length} file(s) (${names}).`);
  } else if (memoryAttachments?.length) {
    parts.push(`Prior attachments in this thread: ${memoryAttachments.join(", ")}.`);
  }

  if (memorySummary?.trim()) {
    parts.push(`Prior turn summary: ${memorySummary.trim()}`);
  }

  if (priorAnalysis) {
    parts.push(`Prior assistant analysis:\n${priorAnalysis}`);
  }

  if (parts.length === 1) {
    return null;
  }

  return limitContextTokens(parts.join("\n\n"));
}

export async function buildFollowUpContextWithFallback(input: {
  scope: LedgerScope | null;
  workspaceId: string;
  appHistory: ChatMessage[];
  userInput: string;
  memoryRecord?: LedgerWorkingMemory | null;
}): Promise<string | null> {
  const direct = buildFollowUpContext({
    appHistory: input.appHistory,
    userInput: input.userInput,
    memoryRecord: input.memoryRecord,
  });
  if (direct) return direct;

  if (!referencesPriorTurn(input.userInput) || !input.scope || !input.workspaceId) {
    return null;
  }

  const fromDb = await buildRecentTurnContextFromMessages(input.scope, input.workspaceId);
  if (!fromDb) {
    return limitContextTokens(
      `The user is continuing a prior turn. ${CANVAS_CONTINUITY_RULE}`
    );
  }

  return limitContextTokens(
    `The user is continuing a prior conversation turn. ${CANVAS_CONTINUITY_RULE}\n\n${fromDb}`
  );
}

export async function buildRecentTurnContextFromMessages(
  scope: LedgerScope,
  workspaceId: string
): Promise<string | null> {
  try {
    const messages = await listMessages(scope, workspaceId);
    if (messages.length === 0) return null;

    const recent = messages.slice(-12);
    const lastUser = [...recent].reverse().find(
      (message) => message.role === "user" && message.type === "text"
    );
    const lastAssistant = getLastAssistantText(recent);
    const lastUserWithFiles = getLastUserMessageWithFiles(recent);

    const parts: string[] = [
      "Recent workspace conversation context (from stored messages):",
    ];

    if (lastUser?.content.trim()) {
      parts.push(`Last user message: ${lastUser.content.trim()}`);
    }

    if (lastUserWithFiles?.files?.length) {
      parts.push(
        `Last uploaded files: ${lastUserWithFiles.files.map((file) => file.name).join(", ")}`
      );
    }

    if (lastAssistant) {
      parts.push(`Last assistant analysis:\n${lastAssistant.slice(0, 2000)}`);
    }

    if (parts.length === 1) return null;
    return limitContextTokens(parts.join("\n\n"));
  } catch {
    return null;
  }
}
