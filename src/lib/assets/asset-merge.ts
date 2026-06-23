import type { Asset, AssetDefinitionInput } from "@/lib/assets/asset";

type TableRow = Record<string, string | number | null>;
type ChartPoint = { label: string; value: number };

function asTableRows(data: Record<string, unknown> | undefined): TableRow[] {
  const rows = data?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (row): row is TableRow => typeof row === "object" && row !== null && !Array.isArray(row)
  );
}

function asChartSeries(data: Record<string, unknown> | undefined): ChartPoint[] {
  const series = data?.series;
  if (!Array.isArray(series)) return [];
  return series.filter(
    (point): point is ChartPoint =>
      typeof point === "object" &&
      point !== null &&
      typeof (point as ChartPoint).label === "string" &&
      typeof (point as ChartPoint).value === "number"
  );
}

function getColumnKeys(asset: Asset, incoming: AssetDefinitionInput): string[] {
  const incomingColumns = incoming.schema?.columns;
  if (Array.isArray(incomingColumns) && incomingColumns.length > 0) {
    return incomingColumns
      .map((column) =>
        typeof column === "object" && column !== null && "key" in column
          ? String((column as { key: unknown }).key)
          : ""
      )
      .filter(Boolean);
  }

  const existingColumns = asset.schema.columns;
  if (Array.isArray(existingColumns) && existingColumns.length > 0) {
    return existingColumns
      .map((column) =>
        typeof column === "object" && column !== null && "key" in column
          ? String((column as { key: unknown }).key)
          : ""
      )
      .filter(Boolean);
  }

  const sample = asTableRows(asset.data)[0] ?? asTableRows(incoming.data)[0];
  return sample ? Object.keys(sample) : [];
}

function rowFingerprint(row: TableRow, keys: string[]): string {
  return keys.map((key) => String(row[key] ?? "")).join("\0");
}

function isBlankRow(row: TableRow): boolean {
  return Object.values(row).every((value) => String(value ?? "").trim().length === 0);
}

function getRowLabel(row: TableRow): string {
  for (const value of Object.values(row)) {
    const text = String(value ?? "").trim();
    if (text.length > 0) return text;
  }
  return "";
}

function normalizeRowToColumns(
  row: TableRow,
  columns: Array<{ key: string; label?: string }>
): TableRow {
  const normalized: TableRow = {};
  const values = Object.values(row);

  for (const [index, column] of columns.entries()) {
    const byKey = row[column.key];
    const byLabel = column.label ? row[column.label] : undefined;
    const byIndex = values[index];
    const raw = byKey ?? byLabel ?? byIndex ?? "";
    normalized[column.key] = raw as string | number | null;
  }

  return normalized;
}

function mergeTableDefinition(existing: Asset, incoming: AssetDefinitionInput): AssetDefinitionInput {
  const columns = Array.isArray(incoming.schema?.columns)
    ? (incoming.schema.columns as Array<{ key: string; label?: string }>)
    : Array.isArray(existing.schema.columns)
      ? (existing.schema.columns as Array<{ key: string; label?: string }>)
      : [];

  const existingRows = asTableRows(existing.data)
    .filter((row) => !isBlankRow(row))
    .map((row) => (columns.length > 0 ? normalizeRowToColumns(row, columns) : row));
  const incomingRows = asTableRows(incoming.data)
    .filter((row) => !isBlankRow(row))
    .map((row) => (columns.length > 0 ? normalizeRowToColumns(row, columns) : row));

  const keys = getColumnKeys(existing, incoming);
  const labelKey = keys[0] ?? "category";

  const merged = [...existingRows];
  const fingerprints = new Set(merged.map((row) => rowFingerprint(row, keys)));

  for (const row of incomingRows) {
    const label = getRowLabel(row) || String(row[labelKey] ?? "");
    const existingIndex =
      label.length > 0
        ? merged.findIndex(
            (candidate) =>
              getRowLabel(candidate) === label || String(candidate[labelKey] ?? "") === label
          )
        : -1;

    if (existingIndex >= 0) {
      merged[existingIndex] = { ...merged[existingIndex], ...row };
      fingerprints.add(rowFingerprint(merged[existingIndex], keys));
      continue;
    }

    const fingerprint = rowFingerprint(row, keys);
    if (!fingerprints.has(fingerprint)) {
      merged.push(row);
      fingerprints.add(fingerprint);
    }
  }

  return {
    ...incoming,
    title: existing.title,
    schema: {
      ...existing.schema,
      ...incoming.schema,
      columns: incoming.schema?.columns ?? existing.schema.columns,
    },
    data: { rows: merged.filter((row) => !isBlankRow(row)) },
    metadata: {
      ...existing.metadata,
      ...incoming.metadata,
      mergedAt: new Date().toISOString(),
    },
  };
}

function mergeChartDefinition(existing: Asset, incoming: AssetDefinitionInput): AssetDefinitionInput {
  const byLabel = new Map<string, ChartPoint>();
  for (const point of asChartSeries(existing.data)) {
    byLabel.set(point.label, point);
  }
  for (const point of asChartSeries(incoming.data)) {
    byLabel.set(point.label, { ...byLabel.get(point.label), ...point });
  }

  return {
    ...incoming,
    title: existing.title,
    schema: { ...existing.schema, ...incoming.schema },
    data: { series: Array.from(byLabel.values()) },
    metadata: {
      ...existing.metadata,
      ...incoming.metadata,
      mergedAt: new Date().toISOString(),
    },
  };
}

export function mergeAssetDefinitionForUpdate(
  existing: Asset,
  incoming: AssetDefinitionInput
): AssetDefinitionInput {
  if (existing.kind !== incoming.kind) {
    return { ...incoming, title: existing.title };
  }

  switch (existing.kind) {
    case "table":
      return mergeTableDefinition(existing, incoming);
    case "chart":
      return mergeChartDefinition(existing, incoming);
    case "dashboard":
      return {
        ...incoming,
        title: existing.title,
        schema: { ...existing.schema, ...incoming.schema },
        data: { ...existing.data, ...incoming.data },
        metadata: {
          ...existing.metadata,
          ...incoming.metadata,
          mergedAt: new Date().toISOString(),
        },
      };
    default:
      return {
        ...incoming,
        title: existing.title,
        schema: { ...existing.schema, ...incoming.schema },
        data: { ...incoming.data, ...existing.data },
        metadata: { ...existing.metadata, ...incoming.metadata },
      };
  }
}
