import type { ChatMessage } from "@/lib/chat-types";

export function messagesStorageKey(workspaceId: string): string {
  return `chrysty-workspace-messages:${workspaceId}`;
}

export function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    (item.role === "user" || item.role === "assistant") &&
    typeof item.type === "string" &&
    typeof item.createdAt === "string"
  );
}

export function parseLegacyMessages(raw: string | null): ChatMessage[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isChatMessage);
  } catch {
    return [];
  }
}
