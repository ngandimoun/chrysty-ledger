"use client";

import type { Asset } from "@/lib/assets/asset";
import { ChartRenderer } from "@/components/canvas/chart-renderer";
import { cn } from "@/lib/utils";
import { z } from "zod";

type DashboardRendererProps = {
  asset: Asset;
  className?: string;
};

const WidgetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("metric"),
    title: z.string(),
    dataKey: z.string(),
  }),
  z.object({
    type: z.literal("viz"),
    title: z.string().optional(),
    intent: z.string(),
    dataKey: z.string().optional(),
  }),
]);

export function DashboardRenderer({ asset, className }: DashboardRendererProps) {
  const widgets = z.array(WidgetSchema).parse(asset.schema.widgets ?? []);
  const metrics = (asset.data.metrics as Record<string, string | number>) ?? {};

  if (!widgets.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No widgets configured for this dashboard.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {widgets
          .filter((w) => w.type === "metric")
          .map((widget) => (
            <div
              key={widget.dataKey}
              className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
            >
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {widget.title}
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {String(metrics[widget.dataKey] ?? "—")}
              </p>
            </div>
          ))}
      </div>

      {widgets
        .filter((w) => w.type === "viz")
        .map((widget, index) => {
          const seriesKey = widget.dataKey ?? "series";
          const series = (asset.data[seriesKey] as { label: string; value: number }[]) ?? [];
          const chartAsset: Asset = {
            ...asset,
            kind: "chart",
            title: widget.title ?? asset.title,
            schema: { intent: widget.intent, title: widget.title },
            data: { series },
          };
          return (
            <div key={`viz-${index}`} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <ChartRenderer asset={chartAsset} />
            </div>
          );
        })}
    </div>
  );
}
