"use client";

import type { ComponentType } from "react";

import { ChartRenderer } from "@/components/canvas/chart-renderer";
import { DashboardRenderer } from "@/components/canvas/dashboard-renderer";
import { DocumentRenderer } from "@/components/canvas/document-renderer";
import { FileRenderer } from "@/components/canvas/file-renderer";
import { GenericRenderer } from "@/components/canvas/generic-renderer";
import { RendererErrorBoundary } from "@/components/canvas/renderer-error-boundary";
import { TableRenderer } from "@/components/canvas/table-renderer";
import type { Asset } from "@/lib/assets/asset";

export type AssetRendererProps = {
  asset: Asset;
  className?: string;
};

export type AssetRenderer = ComponentType<AssetRendererProps>;

const renderers: Record<string, AssetRenderer> = {
  table: TableRenderer,
  chart: ChartRenderer,
  dashboard: DashboardRenderer,
  document: DocumentRenderer,
  file: FileRenderer,
};

export function getRenderer(kind: string): AssetRenderer {
  return renderers[kind] ?? GenericRenderer;
}

export function RenderAsset({ asset, className }: AssetRendererProps) {
  const Renderer = getRenderer(asset.kind);
  return (
    <RendererErrorBoundary title={`Couldn't display "${asset.title}"`}>
      <Renderer asset={asset} className={className} />
    </RendererErrorBoundary>
  );
}
