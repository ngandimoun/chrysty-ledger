"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  chartDonutRadii,
  colorForIndex,
  formatChartValue,
} from "@/lib/viz/chart-colors";
import {
  chartAxisLine,
  chartLegendProps,
  chartTickLine,
  chartTickStyle,
  chartTooltipProps,
} from "@/lib/viz/recharts-theme";
import type { VizChartType } from "@/lib/viz/viz-engine";
import { cn } from "@/lib/utils";

export type SeriesPoint = { label: string; value: number };

type SeriesChartProps = {
  chartType: VizChartType;
  data: SeriesPoint[];
  title?: string;
  compact?: boolean;
  className?: string;
  width: number;
};

export function SeriesChart({
  chartType,
  data,
  title,
  compact = false,
  className,
  width,
}: SeriesChartProps) {
  const height = compact ? 180 : 280;
  const tick = chartTickStyle(compact ? 10 : 12);
  const axisProps = {
    tick,
    axisLine: chartAxisLine,
    tickLine: chartTickLine,
    stroke: "var(--border)",
  };
  const labels = data.map((point) => point.label);
  const formatValue = (value: number) => formatChartValue(value, { title, labels });

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground",
          className
        )}
      >
        No chart data available.
      </div>
    );
  }

  if (width <= 0) {
    return null;
  }

  if (chartType === "line") {
    return (
      <div className={cn("notranslate w-full min-w-0", className)} translate="no">
        <ResponsiveContainer width={width} height={height}>
          <LineChart data={data}>
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v) => formatValue(Number(v))} />
            <Tooltip {...chartTooltipProps} formatter={(value) => formatValue(Number(value))} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={colorForIndex(0)}
              strokeWidth={2}
              dot={{ fill: colorForIndex(0), r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "pie" || chartType === "donut") {
    const { innerRadius, outerRadius } =
      chartType === "donut" ? chartDonutRadii(compact) : { innerRadius: 0, outerRadius: compact ? 70 : 100 };

    return (
      <div className={cn("notranslate w-full min-w-0", className)} translate="no">
        <ResponsiveContainer width={width} height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={`${entry.label}-${index}`} fill={colorForIndex(index)} />
              ))}
            </Pie>
            <Tooltip {...chartTooltipProps} formatter={(value) => formatValue(Number(value))} />
            <Legend {...chartLegendProps} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className={cn("notranslate w-full min-w-0", className)} translate="no">
      <ResponsiveContainer width={width} height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
          <XAxis
            dataKey="label"
            {...axisProps}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={56}
          />
          <YAxis {...axisProps} tickFormatter={(v) => formatValue(Number(v))} />
          <Tooltip {...chartTooltipProps} formatter={(value) => formatValue(Number(value))} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`${entry.label}-${index}`} fill={colorForIndex(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
