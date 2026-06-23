"use client";

import { useEffect, useState } from "react";

import { useOptionalLedgerScope } from "@/contexts/ledger-context";
import type { Asset } from "@/lib/assets/asset";
import { fetchWorkspaceFileUrl } from "@/lib/workspace-file-api";
import { cn } from "@/lib/utils";

type FileRendererProps = {
  asset: Asset;
  className?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileRenderer({ asset, className }: FileRendererProps) {
  const scope = useOptionalLedgerScope();
  const filename = String(asset.schema.filename ?? asset.title);
  const mimeType = String(asset.schema.mimeType ?? asset.metadata.mimeType ?? "");
  const size = typeof asset.data.size === "number" ? asset.data.size : undefined;
  const files = (asset.data.files as { name: string; size: string }[]) ?? [];
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!scope || !asset.data.storageRef) return;

    let cancelled = false;

    void fetchWorkspaceFileUrl({
      workspaceId: asset.workspaceId,
      assetId: asset.id,
      ledgerKey: scope.ledgerKey,
      userId: scope.userId,
    })
      .then((url) => {
        if (!cancelled) {
          setFileUrl(url);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load file");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [asset.data.storageRef, asset.id, asset.workspaceId, scope]);

  if (files.length > 0) {
    return (
      <ul className={cn("flex flex-col gap-2", className)}>
        {files.map((file) => (
          <li
            key={file.name}
            className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
          >
            <span className="truncate text-foreground">{file.name}</span>
            <span className="shrink-0 text-muted-foreground">{file.size}</span>
          </li>
        ))}
      </ul>
    );
  }

  const isImage = mimeType.startsWith("image/");

  return (
    <div className={cn("rounded-lg border border-border bg-muted/30 p-6", className)}>
      <p className="text-sm font-medium text-foreground">{filename}</p>
      {size !== undefined ? (
        <p className="mt-1 text-xs text-muted-foreground">{formatFileSize(size)}</p>
      ) : null}
      {loadError ? <p className="mt-2 text-xs text-destructive">{loadError}</p> : null}
      {isImage && fileUrl ? (
        <img
          src={fileUrl}
          alt={filename}
          className="mt-4 max-h-[480px] w-full rounded-lg border border-border object-contain"
        />
      ) : null}
      {fileUrl ? (
        <a
          href={fileUrl}
          className="mt-4 inline-block text-sm text-primary underline"
          target="_blank"
          rel="noreferrer"
        >
          {isImage ? "Open full image" : "Open / Download"}
        </a>
      ) : null}
    </div>
  );
}
