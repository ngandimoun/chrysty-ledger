import { z } from "zod";

import type { Asset, AssetDefinitionInput } from "@/lib/assets/asset";
import { createEmptyAsset } from "@/lib/assets/asset";
import {
  AssetDefinitionSchema,
  ChartDataSchema,
  ChartSchemaSchema,
  DashboardDataSchema,
  DashboardSchemaSchema,
  DocumentDataSchema,
  DocumentSchemaSchema,
  FileDataSchema,
  FileSchemaSchema,
  TableDataSchema,
  TableSchemaSchema,
  type TableColumn,
} from "@/lib/assets/schemas/kinds";

export type ValidationResult =
  | { ok: true; asset: Asset }
  | { ok: false; errors: string[]; hints: string[] };

function validateKindShape(kind: string, schema: Record<string, unknown>, data: Record<string, unknown>) {
  switch (kind) {
    case "table": {
      TableSchemaSchema.parse(schema);
      const parsedData = TableDataSchema.parse(data);
      const columns = (schema as { columns: TableColumn[] }).columns;
      const keys = new Set(columns.map((c) => c.key));
      for (const row of parsedData.rows) {
        for (const key of Object.keys(row)) {
          if (!keys.has(key)) {
            throw new Error(`Row contains unknown column "${key}"`);
          }
        }
      }
      return;
    }
    case "chart": {
      ChartSchemaSchema.parse(schema);
      ChartDataSchema.parse(data);
      return;
    }
    case "dashboard": {
      DashboardSchemaSchema.parse(schema);
      DashboardDataSchema.parse(data);
      return;
    }
    case "document": {
      DocumentSchemaSchema.parse(schema);
      DocumentDataSchema.parse(data);
      return;
    }
    case "file": {
      FileSchemaSchema.parse(schema);
      FileDataSchema.parse(data);
      return;
    }
    default:
      return;
  }
}

export function normalizeAssetDefinition(
  input: AssetDefinitionInput & { kind: string }
): AssetDefinitionInput {
  const base = AssetDefinitionSchema.parse({
    kind: input.kind,
    subtype: input.subtype,
    title: input.title?.trim() || "Untitled",
    schema: input.schema ?? {},
    data: input.data ?? {},
    relations: input.relations ?? [],
    metadata: input.metadata ?? {},
  });

  if (input.kind === "table") {
    const schema = TableSchemaSchema.parse(base.schema);
    const data = TableDataSchema.parse(base.data);
    const keys = schema.columns.map((c) => c.key);
    const rows = data.rows.map((row) => {
      const normalized: Record<string, string | number | null> = {};
      for (const key of keys) {
        const value = row[key];
        normalized[key] = value === undefined || value === null ? "" : value;
      }
      return normalized;
    });
    return { ...input, ...base, schema: { columns: schema.columns }, data: { rows } };
  }

  if (input.kind === "chart") {
    const schema = ChartSchemaSchema.parse(base.schema);
    const data = ChartDataSchema.parse(base.data);
    return { ...input, ...base, schema, data };
  }

  if (input.kind === "dashboard") {
    const schema = DashboardSchemaSchema.parse(base.schema);
    const data = DashboardDataSchema.parse(base.data);
    return { ...input, ...base, schema, data };
  }

  if (input.kind === "document") {
    const schema = DocumentSchemaSchema.parse(base.schema);
    const data = DocumentDataSchema.parse(base.data);
    return { ...input, ...base, schema, data };
  }

  if (input.kind === "file") {
    const schema = FileSchemaSchema.parse(base.schema);
    const data = FileDataSchema.parse(base.data);
    return { ...input, ...base, schema, data };
  }

  return { ...input, ...base };
}

export function validateAndNormalizeAsset(input: AssetDefinitionInput): ValidationResult {
  try {
    const normalized = normalizeAssetDefinition(input as AssetDefinitionInput & { kind: string });
    validateKindShape(normalized.kind, normalized.schema ?? {}, normalized.data ?? {});
    const asset = createEmptyAsset(normalized);
    return { ok: true, asset };
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      : error instanceof Error
        ? error.message
        : "Validation failed";

    return {
      ok: false,
      errors: [message],
      hints: buildFixHints(input.kind, message),
    };
  }
}

function buildFixHints(kind: string, message: string): string[] {
  const hints: string[] = [];
  if (message.includes("column") || kind === "table") {
    hints.push("Provide schema.columns as a non-empty array with key, label, and type.");
    hints.push("Ensure each data.rows entry only uses keys defined in schema.columns.");
  }
  if (kind === "chart") {
    hints.push("Provide schema.intent and data.series as label/value pairs.");
  }
  if (kind === "dashboard") {
    hints.push("Provide schema.widgets with at least one metric or viz widget.");
  }
  if (kind === "document") {
    hints.push("Provide schema.sections and matching data.sections with body text.");
  }
  if (kind === "file") {
    hints.push("Provide schema.filename and data.storageRef.");
  }
  return hints;
}
