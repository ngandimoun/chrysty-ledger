"use client";

import { useQuery } from "@tanstack/react-query";

import { useOptionalLedgerScope } from "@/contexts/ledger-context";
import { listMessages } from "@/lib/ledger/messages";
import { scopeCacheKey } from "@/lib/ledger/scope";
import { queryKeys } from "@/lib/query-keys";

export function useWorkspaceMessagesQuery(workspaceId: string) {
  const scope = useOptionalLedgerScope();
  const scopeKey = scope ? scopeCacheKey(scope) : null;

  return useQuery({
    queryKey: scopeKey
      ? queryKeys.messages(workspaceId, scopeKey)
      : ["messages", workspaceId, "pending"],
    queryFn: async () => {
      if (!scope) return [];
      return listMessages(scope, workspaceId);
    },
    enabled: Boolean(scope && workspaceId && scopeKey),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}
