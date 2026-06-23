import { z } from "zod";

export const TableColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "currency"]).default("text"),
});

export const TableSchemaSchema = z.object({
  columns: z.array(TableColumnSchema).min(1, "Table must have at least one column"),
});

export const TableDataSchema = z.object({
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).default([]),
});

export const ChartIntentSchema = z.enum([
  "show_over_time",
  "show_revenue_over_time",
  "compare_categories",
  "show_distribution",
  "show_part_of_whole",
  "compare_metrics",
]);

export const ChartSchemaSchema = z.object({
  intent: ChartIntentSchema,
  sourceAssetId: z.string().optional(),
  groupBy: z.string().optional(),
  title: z.string().optional(),
});

export const ChartDataSchema = z.object({
  series: z
    .array(
      z.object({
        label: z.string(),
        value: z.number(),
      })
    )
    .default([]),
});

export const DashboardWidgetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("metric"),
    title: z.string().min(1),
    dataKey: z.string().min(1),
  }),
  z.object({
    type: z.literal("viz"),
    title: z.string().optional(),
    intent: ChartIntentSchema,
    sourceAssetId: z.string().optional(),
    dataKey: z.string().optional(),
  }),
]);

export const DashboardSchemaSchema = z.object({
  widgets: z.array(DashboardWidgetSchema).min(1, "Dashboard must have at least one widget"),
});

export const DashboardDataSchema = z.object({
  metrics: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});

export const DocumentSectionSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["text", "list", "table_ref"]).default("text"),
});

export const DocumentSchemaSchema = z.object({
  sections: z.array(DocumentSectionSchema).min(1, "Document must have at least one section"),
  fields: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
});

export const DocumentDataSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.string(),
        body: z.string().default(""),
      })
    )
    .default([]),
  lineItems: z.array(z.record(z.string(), z.unknown())).optional(),
  total: z.union([z.string(), z.number()]).optional(),
});

export const FileSchemaSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().optional(),
});

export const FileDataSchema = z.object({
  storageRef: z.string().min(1),
  size: z.number().optional(),
  url: z.string().optional(),
});

export const AssetRelationSchema = z.object({
  targetAssetId: z.string().min(1),
  relation: z.string().min(1),
});

export const AssetDefinitionSchema = z.object({
  kind: z.string().min(1),
  subtype: z.string().nullable().optional(),
  title: z.string().min(1),
  schema: z.record(z.string(), z.unknown()).default({}),
  data: z.record(z.string(), z.unknown()).default({}),
  relations: z.array(AssetRelationSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type TableColumn = z.infer<typeof TableColumnSchema>;
export type ChartIntent = z.infer<typeof ChartIntentSchema>;
