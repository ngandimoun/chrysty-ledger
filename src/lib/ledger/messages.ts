import type { ChatMessage } from "@/lib/chat-types";

import { messageFromRow } from "@/lib/ledger/mappers";
import { getWorkspaceRow } from "@/lib/ledger/workspaces";
import type { LedgerScope } from "@/lib/ledger/scope";

async function assertWorkspaceAccess(
  scope: LedgerScope,
  workspaceId: string
): Promise<void> {
  const row = await getWorkspaceRow(scope, workspaceId);
  if (!row) {
    throw new Error("Workspace not found");
  }
}

export async function listMessages(
  scope: LedgerScope,
  workspaceId: string
): Promise<ChatMessage[]> {
  await assertWorkspaceAccess(scope, workspaceId);

  const { data, error } = await scope.supabase
    .from("ledger_messages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(messageFromRow);
}

export async function insertMessage(
  scope: LedgerScope,
  workspaceId: string,
  message: ChatMessage
): Promise<void> {
  await assertWorkspaceAccess(scope, workspaceId);

  const { error } = await scope.supabase.from("ledger_messages").insert({
    id: message.id,
    workspace_id: workspaceId,
    payload: message,
    created_at: message.createdAt,
  });

  if (error) throw error;
}

export async function updateMessage(
  scope: LedgerScope,
  workspaceId: string,
  message: ChatMessage
): Promise<void> {
  await assertWorkspaceAccess(scope, workspaceId);

  const { error } = await scope.supabase
    .from("ledger_messages")
    .update({ payload: message })
    .eq("workspace_id", workspaceId)
    .eq("id", message.id);

  if (error) throw error;
}
