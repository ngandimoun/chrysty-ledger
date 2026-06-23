"use client";

import { useQuery } from "@tanstack/react-query";

import { useOptionalLedgerScope } from "@/contexts/ledger-context";
import { listMessages } from "@/lib/ledger/messages";
import { queryKeys } from "@/lib/query-keys";

export function useWorkspaceMessagesQuery(workspaceId: string) {
  const scope = useOptionalLedgerScope();

  return useQuery({
    queryKey: queryKeys.messages(workspaceId),
    queryFn: async () => {
      if (!scope) return [];
      return listMessages(scope, workspaceId);
    },
    enabled: Boolean(scope && workspaceId),
    refetchOnWindowFocus: false,
  });
}
