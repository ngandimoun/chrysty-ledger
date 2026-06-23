import { z } from "zod";

import type { WorkspaceArtifact } from "@/lib/artifact-types";

const ChartDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
});

export const TableArtifactSchema = z.object({
  id: z.string(),
  kind: z.literal("table"),
  title: z.string(),
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.string())),
});

export const ChartArtifactSchema = z.object({
  id: z.string(),
  kind: z.literal("chart"),
  title: z.string(),
  chartType: z.enum(["bar", "pie"]),
  data: z.array(ChartDataPointSchema),
});

export const FileListArtifactSchema = z.object({
  id: z.string(),
  kind: z.literal("file-list"),
  title: z.string(),
  files: z.array(
    z.object({
      name: z.string(),
      size: z.string(),
    })
  ),
});

export const DocumentArtifactSchema = z.object({
  id: z.string(),
  kind: z.literal("document"),
  title: z.string(),
  content: z.string(),
});

export const DashboardArtifactSchema = z.object({
  id: z.string(),
  kind: z.literal("dashboard"),
  title: z.string(),
  kpis: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    })
  ),
  chart: ChartArtifactSchema.omit({ id: true, kind: true, title: true }).optional(),
});

export const InvoiceArtifactSchema = z.object({
  id: z.string(),
  kind: z.literal("invoice"),
  title: z.string(),
  invoiceNumber: z.string(),
  clientName: z.string(),
  issueDate: z.string(),
  dueDate: z.string(),
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      rate: z.string(),
      amount: z.string(),
    })
  ),
  total: z.string(),
});

export const WorkspaceArtifactSchema = z.discriminatedUnion("kind", [
  TableArtifactSchema,
  ChartArtifactSchema,
  FileListArtifactSchema,
  DocumentArtifactSchema,
  DashboardArtifactSchema,
  InvoiceArtifactSchema,
]);

export function parseWorkspaceArtifact(raw: unknown): WorkspaceArtifact {
  return WorkspaceArtifactSchema.parse(raw) as WorkspaceArtifact;
}

export function safeParseWorkspaceArtifact(raw: unknown) {
  return WorkspaceArtifactSchema.safeParse(raw);
}
