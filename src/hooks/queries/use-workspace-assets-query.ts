"use client";

import { useQuery } from "@tanstack/react-query";

import { useOptionalLedgerScope } from "@/contexts/ledger-context";
import { listAssets } from "@/lib/ledger/assets";
import { scopeCacheKey } from "@/lib/ledger/scope";
import { queryKeys } from "@/lib/query-keys";

export function useWorkspaceAssetsQuery(workspaceId: string) {
  const scope = useOptionalLedgerScope();
  const scopeKey = scope ? scopeCacheKey(scope) : null;

  return useQuery({
    queryKey: scopeKey
      ? queryKeys.assets(workspaceId, scopeKey)
      : ["assets", workspaceId, "pending"],
    queryFn: async () => {
      if (!scope) return [];
      return listAssets(scope, workspaceId);
    },
    enabled: Boolean(scope && workspaceId && scopeKey),
    staleTime: 0,
  });
}
