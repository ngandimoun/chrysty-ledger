import type { LedgerScope } from "@/lib/ledger/scope";

export type LedgerRequestContext = {
  workspaceId: string;
  userId: string;
  ledgerScope: LedgerScope;
};

export const LEDGER_CONTEXT_KEYS = {
  workspaceId: "workspaceId",
  userId: "userId",
  ledgerScope: "ledgerScope",
} as const;

export function getLedgerScopeFromContext(
  requestContext: { get: (key: string) => unknown } | undefined
): LedgerScope | null {
  const scope = requestContext?.get(LEDGER_CONTEXT_KEYS.ledgerScope);
  if (!scope || typeof scope !== "object") return null;
  return scope as LedgerScope;
}
