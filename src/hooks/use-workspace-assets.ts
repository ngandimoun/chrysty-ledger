"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useOptionalLedgerScope } from "@/contexts/ledger-context";
import { useWorkspaceAssetsQuery } from "@/hooks/queries/use-workspace-assets-query";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { Asset } from "@/lib/assets/asset";
import { assetV2ToWorkspaceAsset } from "@/lib/assets/adapters/legacy";
import type { GroupedAssets, WorkspaceAsset } from "@/lib/asset-types";
import { upsertAsset as upsertLedgerAsset } from "@/lib/ledger/assets";
import { insertAssetEvent, nextAssetSequence, nextCreationSequence } from "@/lib/ledger/events";
import { migrateMessagesToAssets } from "@/lib/migrate-message-assets";
import { scopeCacheKey } from "@/lib/ledger/scope";
import type { ChatMessage } from "@/lib/chat-types";
import { createMessageId } from "@/lib/chat-types";
import { queryKeys } from "@/lib/query-keys";
import {
  applyArtifactRegistration,
  assetNeedsMetadataBackfill,
  backfillAssetMetadata,
  filterAssets,
  groupAssetsByKind,
  mergeChatUploadsIntoAssets,
  sortDisplayAssets,
  resolveAssetForOpen,
  resolveOccurredAt,
} from "@/lib/workspace-assets";

const EMPTY_ASSETS: WorkspaceAsset[] = [];

export function useWorkspaceAssets(workspaceId: string, messages: ChatMessage[] = []) {
  const scope = useOptionalLedgerScope();
  const queryClient = useQueryClient();
  const scopeKey = scope ? scopeCacheKey(scope) : null;
  const assetsQueryKey =
    scopeKey != null ? queryKeys.assets(workspaceId, scopeKey) : null;
  const [searchQuery, setSearchQuery] = useState("");
  const migratedRef = useRef(false);

  const migratedWorkspaceRef = useRef<string | null>(null);

  const assetsQuery = useWorkspaceAssetsQuery(workspaceId);

  useEffect(() => {
    if (migratedWorkspaceRef.current !== workspaceId) {
      migratedWorkspaceRef.current = workspaceId;
      migratedRef.current = false;
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!scope || !assetsQuery.isSuccess || migratedRef.current) return;

    const rows = assetsQuery.data ?? [];
    let next = migrateMessagesToAssets(workspaceId, messages, rows);
    migratedRef.current = true;

    next = backfillAssetMetadata(workspaceId, next);

    const needsPersist = next.some(
      (asset) =>
        assetNeedsMetadataBackfill(asset) || !rows.find((row) => row.id === asset.id)
    );

    if (needsPersist || next.length !== rows.length) {
      if (!assetsQueryKey) return;
      queryClient.setQueryData(assetsQueryKey, next);

      void (async () => {
        for (const asset of next) {
          if (assetNeedsMetadataBackfill(asset) || !rows.find((row) => row.id === asset.id)) {
            await upsertLedgerAsset(scope, asset);
          }
        }
      })();
    }
  }, [scope, assetsQuery.isSuccess, assetsQuery.data, workspaceId, messages, queryClient, assetsQueryKey]);

  const assets = assetsQuery.data ?? EMPTY_ASSETS;
  const isHydrated = assetsQuery.isFetched;
  const displayAssets = useMemo(
    () => sortDisplayAssets(mergeChatUploadsIntoAssets(workspaceId, assets, messages)),
    [assets, messages, workspaceId]
  );

  const persistAssetChange = useCallback(
    async (
      asset: WorkspaceAsset,
      event: {
        type: "asset_created" | "asset_updated";
        occurredAt: string;
        sourceMessageId?: string;
        artifact: WorkspaceArtifact;
      }
    ) => {
      if (!scope) return;

      await upsertLedgerAsset(scope, asset);

      const sequence = await nextAssetSequence(scope, workspaceId);
      await insertAssetEvent(scope, {
        id: createMessageId(),
        workspaceId,
        sequence,
        type: event.type,
        occurredAt: event.occurredAt,
        assetId: asset.id,
        version: asset.version,
        title: asset.title,
        payload: event.artifact,
        sourceMessageId: event.sourceMessageId,
      });
    },
    [scope, workspaceId]
  );

  const registerMutation = useMutation({
    mutationFn: async (input: {
      artifact: WorkspaceArtifact;
      sourceMessageId?: string;
      occurredAt?: string;
    }) => {
      if (!scope) throw new Error("Ledger is not ready");
      if (!assetsQueryKey) throw new Error("Assets query is not ready");

      const current =
        queryClient.getQueryData<WorkspaceAsset[]>(assetsQueryKey) ?? [];
      const timestamp =
        input.occurredAt ?? resolveOccurredAt(messages, input.sourceMessageId);

      const existing = current.find((item) => item.id === input.artifact.id);
      const creationSequence = existing
        ? undefined
        : await nextCreationSequence(scope, workspaceId);

      const result = applyArtifactRegistration({
        workspaceId,
        artifact: input.artifact,
        sourceMessageId: input.sourceMessageId,
        occurredAt: timestamp,
        existingAssets: current,
        creationSequence,
      });

      queryClient.setQueryData(assetsQueryKey, result.assets);

      await persistAssetChange(result.asset, {
        type: result.isCreate ? "asset_created" : "asset_updated",
        occurredAt: timestamp,
        sourceMessageId: input.sourceMessageId,
        artifact: input.artifact,
      });

      return result.asset;
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save asset");
      if (assetsQueryKey) {
        void queryClient.invalidateQueries({ queryKey: assetsQueryKey });
      }
    },
  });

  const filteredAssets = useMemo(
    () => filterAssets(displayAssets, searchQuery),
    [displayAssets, searchQuery]
  );

  const groupedAssets: GroupedAssets[] = useMemo(
    () => groupAssetsByKind(filteredAssets),
    [filteredAssets]
  );

  const registerAssetV2 = useCallback(
    async (asset: Asset, sourceMessageId?: string, occurredAt?: string) => {
      const workspaceAsset = assetV2ToWorkspaceAsset(asset);

      queryClient.setQueryData<WorkspaceAsset[]>(assetsQueryKey!, (current) => {
        const list = current ?? [];
        const index = list.findIndex((item) => item.id === workspaceAsset.id);
        if (index >= 0) {
          const next = [...list];
          next[index] = workspaceAsset;
          return next;
        }
        return [workspaceAsset, ...list];
      });

      await registerMutation.mutateAsync({
        artifact: workspaceAsset.payload,
        sourceMessageId,
        occurredAt,
      });

      return workspaceAsset;
    },
    [registerMutation, queryClient, workspaceId, assetsQueryKey]
  );

  const registerAssetsV2 = useCallback(
    async (items: { asset: Asset; sourceMessageId?: string }[]) => {
      for (const item of items) {
        await registerAssetV2(item.asset, item.sourceMessageId);
      }
    },
    [registerAssetV2]
  );

  const registerArtifact = useCallback(
    (artifact: WorkspaceArtifact, sourceMessageId?: string, occurredAt?: string) => {
      void registerMutation.mutateAsync({ artifact, sourceMessageId, occurredAt }).catch(() => {});
      return assets.find((item) => item.id === artifact.id) ?? null;
    },
    [registerMutation, assets]
  );

  const registerArtifacts = useCallback(
    (items: { artifact: WorkspaceArtifact; sourceMessageId?: string }[]) => {
      void (async () => {
        for (const item of items) {
          await registerMutation.mutateAsync({
            artifact: item.artifact,
            sourceMessageId: item.sourceMessageId,
            occurredAt: resolveOccurredAt(messages, item.sourceMessageId),
          });
        }
      })();
    },
    [registerMutation, messages]
  );

  const getAssetById = useCallback(
    (assetId: string) => displayAssets.find((asset) => asset.id === assetId),
    [displayAssets]
  );

  const resolveAssetForOpenFromCache = useCallback(
    (assetId: string, artifact?: WorkspaceArtifact) =>
      resolveAssetForOpen({
        assetId,
        workspaceId,
        assets: displayAssets,
        displayAssets,
        artifact,
      }),
    [assets, displayAssets, workspaceId]
  );

  const ensureAssetInCache = useCallback(
    (asset: WorkspaceAsset) => {
      queryClient.setQueryData<WorkspaceAsset[]>(assetsQueryKey!, (current) => {
        const list = current ?? [];
        const index = list.findIndex((item) => item.id === asset.id);
        if (index >= 0) {
          const next = [...list];
          next[index] = asset;
          return next;
        }
        return [asset, ...list];
      });
    },
    [queryClient, workspaceId, assetsQueryKey]
  );

  const syncAssetV2ToCache = useCallback(
    (asset: Asset) => {
      ensureAssetInCache(assetV2ToWorkspaceAsset(asset));
    },
    [ensureAssetInCache]
  );

  return {
    assets: displayAssets,
    filteredAssets,
    groupedAssets,
    searchQuery,
    setSearchQuery,
    isHydrated: isHydrated || assetsQuery.isError,
    isAssetsLoading: assetsQuery.isLoading,
    registerArtifact,
    registerArtifacts,
    registerAssetV2,
    registerAssetsV2,
    getAssetById,
    resolveAssetForOpen: resolveAssetForOpenFromCache,
    ensureAssetInCache,
    syncAssetV2ToCache,
  };
}
