import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type LedgerScope = {
  supabase: SupabaseClient<Database>;
  ledgerKey: string;
  userId: string | null;
};

/** Browser anonymous sessions use ledger_* keys — never use those as Supabase auth user UUIDs. */
export function normalizeScopeUserId(
  ledgerKey: string,
  userId: string | null | undefined
): string | null {
  const key = ledgerKey.trim();
  const raw = userId?.trim();
  if (!raw) return null;
  if (raw.startsWith("ledger_") || raw === key) return null;
  return raw;
}

/** Mastra memory / working-memory resource id (string, not necessarily a UUID). */
export function getLedgerResourceId(ledgerKey: string, userId: string | null | undefined): string {
  return normalizeScopeUserId(ledgerKey, userId) ?? ledgerKey.trim();
}

export function workspaceScopeFilter(scope: LedgerScope): string {
  if (scope.userId) {
    return `ledger_key.eq.${scope.ledgerKey},user_id.eq.${scope.userId}`;
  }
  return `ledger_key.eq.${scope.ledgerKey}`;
}
