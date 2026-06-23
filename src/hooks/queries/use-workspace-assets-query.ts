"use client";

import { useQuery } from "@tanstack/react-query";

import { useOptionalLedgerScope } from "@/contexts/ledger-context";
import { listAssets } from "@/lib/ledger/assets";
import { queryKeys } from "@/lib/query-keys";

export function useWorkspaceAssetsQuery(workspaceId: string) {
  const scope = useOptionalLedgerScope();

  return useQuery({
    queryKey: queryKeys.assets(workspaceId),
    queryFn: async () => {
      if (!scope) return [];
      return listAssets(scope, workspaceId);
    },
    enabled: Boolean(scope && workspaceId),
  });
}
