import type { AssetDefinitionInput } from "@/lib/assets/asset";
import { validateAndNormalizeAsset } from "@/lib/assets/validation/gate";
import { getLastAssistantText, referencesPriorTurn } from "@/lib/ai/conversation-context";
import { extractPromptTopic, introducesNewTopic } from "@/lib/ai/orchestrator/turn-intent";
import type { ChatMessage } from "@/lib/chat-types";

export type ParsedTable = {
  headers: string[];
  rows: string[][];
};

const CATEGORY_HEADER = /category|type|description|item|vendor|client|guest/i;
const AMOUNT_HEADER = /amount|total|spend|spent|cost|value|bill|price/i;
const DATE_HEADER = /date|day|period/i;
const LABEL_HEADER = /item|label|name|status|description/i;
const PAYMENT_LABEL = /total bill|total|paid|remaining|balance|outstanding/i;
const SUMMARY_ROW_LABEL =
  /^(grand\s+)?total\b|^total bill\b|\bpaid\b|\b(remaining\s+)?balance\b|\boutstanding\b|\bbalance due\b|\bamount due\b/i;
const ASCII_VIZ_HEADER = /visual|bar|gauge/i;

const SUBJECT_PATTERNS = [
  /(?:guest|client|customer)\s+([A-Z][\w]+(?:\s+[A-Z][\w]+)*)/i,
  /for\s+(?:your\s+)?(?:guest|client|customer)\s+([^(|\n]+)/i,
];

export function sanitizeTableCellValue(raw: string): string {
  return raw
    .trim()
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`/g, "")
    .trim();
}

export function isSummaryRowLabel(label: string): boolean {
  const text = sanitizeTableCellValue(label).toLowerCase();
  if (!text) return false;
  return SUMMARY_ROW_LABEL.test(text);
}

function getRowLabelColumnIndex(table: ParsedTable): number {
  const categoryIndex = findColumnIndex(table.headers, CATEGORY_HEADER);
  if (categoryIndex !== -1) return categoryIndex;
  return findColumnIndex(table.headers, LABEL_HEADER);
}

export function parseAmount(raw: string): number | null {
  const normalized = sanitizeTableCellValue(raw)
    .replace(/[₹$€£,\s]/g, "")
    .replace(/%$/, "");
  if (!normalized || /^total$/i.test(normalized)) {
    return null;
  }
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

export function containsAsciiVizArtifacts(text: string): boolean {
  return (
    /[█░▓▌▊]/.test(text) ||
    ASCII_VIZ_HEADER.test(text) ||
    /\bVisual\b/i.test(text) ||
    /\bBar\b/i.test(text)
  );
}

export function sanitizeAnalysisTextForParsing(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/[█░▓▌▊]/.test(line))
    .join("\n");
}

export function scoreAnalysisTextForParsing(text: string): number {
  const sanitized = sanitizeAnalysisTextForParsing(text);
  if (!hasParseableNumericTables(sanitized)) return 0;

  let score = 10;
  if (containsAsciiVizArtifacts(text)) score -= 5;
  score += parseTablesFromChat(sanitized).filter((table) => !isAsciiVizTable(table)).length * 3;
  if (sanitized.includes("\t")) score += 2;
  return score;
}

export type ResolveAnalysisTextOptions = {
  attachmentCount?: number;
  hasVision?: boolean;
};

export function resolveAnalysisTextForAssets(
  chatText: string,
  appHistory: ChatMessage[],
  userInput: string,
  options: ResolveAnalysisTextOptions = {}
): string {
  const attachmentCount = options.attachmentCount ?? 0;
  const hasVision = options.hasVision ?? false;
  const prior = getLastAssistantText(appHistory);
  const priorSanitized = prior ? sanitizeAnalysisTextForParsing(prior) : null;
  const currentSanitized = sanitizeAnalysisTextForParsing(chatText);
  const uploadTurn = attachmentCount > 0 || hasVision;

  if (uploadTurn) {
    if (
      referencesPriorTurn(userInput) &&
      priorSanitized &&
      hasParseableNumericTables(priorSanitized) &&
      !introducesNewTopic(userInput, prior)
    ) {
      const priorScore = scoreAnalysisTextForParsing(prior ?? "");
      const currentScore = scoreAnalysisTextForParsing(chatText);
      if (priorScore > currentScore && currentScore === 0) {
        return priorSanitized;
      }
    }
    return currentSanitized;
  }

  if (referencesPriorTurn(userInput) && priorSanitized && hasParseableNumericTables(priorSanitized)) {
    const priorScore = scoreAnalysisTextForParsing(prior ?? "");
    const currentScore = scoreAnalysisTextForParsing(chatText);
    if (priorScore >= currentScore) {
      return priorSanitized;
    }
  }

  if (hasParseableNumericTables(currentSanitized) && !containsAsciiVizArtifacts(chatText)) {
    return currentSanitized;
  }

  if (
    priorSanitized &&
    hasParseableNumericTables(priorSanitized) &&
    !introducesNewTopic(userInput, prior)
  ) {
    return priorSanitized;
  }

  return currentSanitized;
}

function splitRow(line: string): string[] {
  const split = (cells: string[]) =>
    cells.map((cell) => sanitizeTableCellValue(cell)).filter((cell) => cell.length > 0);

  if (line.includes("|")) {
    return split(line.split("|").map((cell) => cell.trim()));
  }
  if (line.includes("\t")) {
    return split(line.split("\t").map((cell) => cell.trim()));
  }
  return split(line.split(/\s{2,}/).map((cell) => cell.trim()));
}

function isSeparatorLine(line: string): boolean {
  return /^[\|\s\-:–—]+$/.test(line) && line.includes("-");
}

function isAsciiVizTable(table: ParsedTable): boolean {
  return table.headers.some((header) => ASCII_VIZ_HEADER.test(header));
}

export function parseTablesFromChat(text: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const lines = text.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (!line || isSeparatorLine(line)) continue;

    const headers = splitRow(line);
    if (headers.length < 2) continue;
    if (headers.some((header) => ASCII_VIZ_HEADER.test(header))) continue;

    const rows: string[][] = [];
    let cursor = index + 1;

    while (cursor < lines.length) {
      const rowLine = lines[cursor]?.trim() ?? "";
      if (!rowLine) break;
      if (isSeparatorLine(rowLine)) {
        cursor += 1;
        continue;
      }
      if (/[█░▓▌▊]/.test(rowLine)) {
        cursor += 1;
        continue;
      }

      const row = splitRow(rowLine);
      if (row.length < 2) break;
      if (Math.abs(row.length - headers.length) > 1) break;

      rows.push(row.slice(0, headers.length));
      cursor += 1;
    }

    if (rows.length > 0) {
      tables.push({ headers, rows });
      index = cursor - 1;
    }
  }

  return tables;
}

function findColumnIndex(headers: string[], pattern: RegExp): number {
  return headers.findIndex((header) => pattern.test(header));
}

export function hasParseableNumericTables(chatText: string): boolean {
  return parseTablesFromChat(sanitizeAnalysisTextForParsing(chatText)).some((table) => {
    const amountIndex = findColumnIndex(table.headers, AMOUNT_HEADER);
    const categoryIndex = findColumnIndex(table.headers, CATEGORY_HEADER);
    const dateIndex = findColumnIndex(table.headers, DATE_HEADER);

    if (amountIndex === -1) return false;

    return table.rows.some((row) => {
      const amount = parseAmount(row[amountIndex] ?? "");
      if (amount === null) return false;
      if (categoryIndex !== -1) return Boolean(row[categoryIndex]?.trim());
      if (dateIndex !== -1) return Boolean(row[dateIndex]?.trim());
      return true;
    });
  });
}

export function extractSubjectName(chatText: string, userInput: string): string | null {
  for (const pattern of SUBJECT_PATTERNS) {
    const match = chatText.match(pattern) ?? userInput.match(pattern);
    const name = match?.[1]?.trim();
    if (name) return name.replace(/\s+/g, " ");
  }
  return null;
}

function validateDefinition(
  workspaceId: string,
  definition: Omit<AssetDefinitionInput, "workspaceId">
): AssetDefinitionInput | null {
  const result = validateAndNormalizeAsset({ workspaceId, ...definition });
  if (!result.ok) return null;
  return {
    workspaceId,
    kind: result.asset.kind,
    subtype: result.asset.subtype,
    title: result.asset.title,
    schema: result.asset.schema,
    data: result.asset.data,
    metadata: result.asset.metadata,
    relations: result.asset.relations,
  };
}

function headerToKey(header: string, index: number): string {
  const key = header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return key || `col_${index}`;
}

function inferColumnType(header: string): "text" | "number" | "date" | "currency" {
  if (DATE_HEADER.test(header)) return "date";
  if (AMOUNT_HEADER.test(header)) return "currency";
  return "text";
}

function stripFilenameExtension(filename: string): string {
  return filename.replace(/\.[a-z0-9]{1,8}$/i, "").trim();
}

function buildTitleContext(
  subjectName: string | null,
  promptTopic?: string | null,
  sourceLabel?: string | null
): string | null {
  if (promptTopic) return promptTopic;
  if (subjectName) return subjectName;
  if (sourceLabel) return sourceLabel;
  return null;
}

function applyTitleContext(base: string, context: string | null): string {
  if (!context) return base;
  if (base.toLowerCase().includes(context.toLowerCase())) return base;
  return `${context} — ${base}`;
}

function buildTableTitle(
  subjectName: string | null,
  headers: string[],
  index: number,
  promptTopic?: string | null,
  sourceLabel?: string | null
): string {
  const summary = headers.slice(0, 3).join(" / ");
  const context = buildTitleContext(subjectName, promptTopic, sourceLabel);
  if (context) {
    return index === 0 ? `${context} summary` : `${context} — ${summary}`;
  }
  if (subjectName) return `${subjectName} — ${summary}`;
  return `Data table ${index + 1}: ${summary}`;
}

function buildPaymentStatusTitle(
  subjectName: string | null,
  promptTopic?: string | null,
  sourceLabel?: string | null
): string {
  const base = subjectName ? `${subjectName} — Payment status` : "Payment status";
  return applyTitleContext(base, buildTitleContext(subjectName, promptTopic, sourceLabel));
}

function rowsToRecords(table: ParsedTable): Array<Record<string, string | number | null>> {
  const columns = table.headers.map((header, columnIndex) => ({
    key: headerToKey(header, columnIndex),
    label: header,
    type: inferColumnType(header),
  }));

  return table.rows.map((row) => {
    const record: Record<string, string | number | null> = {};
    for (const [columnIndex, column] of columns.entries()) {
      const raw = sanitizeTableCellValue(row[columnIndex] ?? "");
      if (column.type === "currency" || column.type === "number") {
        const parsed = parseAmount(raw);
        record[column.key] = parsed ?? raw;
      } else {
        record[column.key] = raw;
      }
    }
    return record;
  });
}

function isPaymentStatusTable(table: ParsedTable): boolean {
  const labelIndex = getRowLabelColumnIndex(table);
  const amountIndex = findColumnIndex(table.headers, AMOUNT_HEADER);
  if (labelIndex === -1 || amountIndex === -1 || table.rows.length === 0) return false;
  return table.rows.every((row) =>
    isSummaryRowLabel(sanitizeTableCellValue(row[labelIndex] ?? ""))
  );
}

function buildPaymentStatusTableAsset(
  workspaceId: string,
  table: ParsedTable,
  subjectName: string | null,
  promptTopic?: string | null,
  sourceLabel?: string | null
): AssetDefinitionInput | null {
  if (table.rows.length < 1 || isAsciiVizTable(table)) return null;

  const columns = table.headers.map((header, columnIndex) => ({
    key: headerToKey(header, columnIndex),
    label: header,
    type: inferColumnType(header),
  }));

  return validateDefinition(workspaceId, {
    kind: "table",
    subtype: "sheet",
    title: buildPaymentStatusTitle(subjectName, promptTopic, sourceLabel),
    schema: { columns },
    data: { rows: rowsToRecords(table) },
    metadata: { source: "chat_analysis", section: "payment_status" },
  });
}

function buildTableAsset(
  workspaceId: string,
  table: ParsedTable,
  subjectName: string | null,
  index: number,
  promptTopic?: string | null,
  sourceLabel?: string | null
): AssetDefinitionInput | null {
  if (table.rows.length < 1 || isAsciiVizTable(table)) return null;

  const columns = table.headers.map((header, columnIndex) => ({
    key: headerToKey(header, columnIndex),
    label: header,
    type: inferColumnType(header),
  }));

  const title = isPaymentStatusTable(table)
    ? buildPaymentStatusTitle(subjectName, promptTopic, sourceLabel)
    : buildTableTitle(subjectName, table.headers, index, promptTopic, sourceLabel);

  return validateDefinition(workspaceId, {
    kind: "table",
    subtype: "sheet",
    title,
    schema: { columns },
    data: { rows: rowsToRecords(table) },
    metadata: {
      source: "chat_analysis",
      ...(isPaymentStatusTable(table) ? { section: "payment_status" } : {}),
    },
  });
}

function partitionSpendingAndSummaryRows(table: ParsedTable): {
  spending: string[][];
  summary: string[][];
} {
  const labelIndex = getRowLabelColumnIndex(table);
  const amountIndex = findColumnIndex(table.headers, AMOUNT_HEADER);
  if (labelIndex === -1 || amountIndex === -1) {
    return { spending: table.rows, summary: [] };
  }

  const spending: string[][] = [];
  const summary: string[][] = [];

  for (const row of table.rows) {
    const label = sanitizeTableCellValue(row[labelIndex] ?? "");
    if (isSummaryRowLabel(label)) {
      summary.push(row);
    } else {
      spending.push(row);
    }
  }

  return { spending, summary };
}

function buildTableAssetsFromParsedTable(
  workspaceId: string,
  table: ParsedTable,
  subjectName: string | null,
  index: number,
  promptTopic?: string | null,
  sourceLabel?: string | null
): AssetDefinitionInput[] {
  if (table.rows.length < 1 || isAsciiVizTable(table)) return [];

  if (isPaymentStatusTable(table)) {
    const paymentOnly = buildPaymentStatusTableAsset(
      workspaceId,
      table,
      subjectName,
      promptTopic,
      sourceLabel
    );
    return paymentOnly ? [paymentOnly] : [];
  }

  const { spending, summary } = partitionSpendingAndSummaryRows(table);
  const assets: AssetDefinitionInput[] = [];

  if (spending.length > 0) {
    const spendingAsset = buildTableAsset(
      workspaceId,
      { headers: table.headers, rows: spending },
      subjectName,
      index,
      promptTopic,
      sourceLabel
    );
    if (spendingAsset) assets.push(spendingAsset);
  }

  if (summary.length > 0) {
    const paymentAsset = buildPaymentStatusTableAsset(
      workspaceId,
      { headers: table.headers, rows: summary },
      subjectName,
      promptTopic,
      sourceLabel
    );
    if (paymentAsset) assets.push(paymentAsset);
  }

  if (assets.length === 0) {
    const fallback = buildTableAsset(
      workspaceId,
      table,
      subjectName,
      index,
      promptTopic,
      sourceLabel
    );
    return fallback ? [fallback] : [];
  }

  return assets;
}

function buildCategoryChart(
  workspaceId: string,
  table: ParsedTable,
  subjectName: string | null,
  sourceTableTitle?: string,
  promptTopic?: string | null,
  sourceLabel?: string | null
): AssetDefinitionInput | null {
  const categoryIndex = findColumnIndex(table.headers, CATEGORY_HEADER);
  const amountIndex = findColumnIndex(table.headers, AMOUNT_HEADER);
  if (categoryIndex === -1 || amountIndex === -1) return null;

  const series = table.rows
    .map((row) => {
      const label = sanitizeTableCellValue(row[categoryIndex] ?? "");
      const value = parseAmount(row[amountIndex] ?? "");
      if (!label || value === null || isSummaryRowLabel(label)) return null;
      return { label, value };
    })
    .filter((point): point is { label: string; value: number } => point !== null);

  if (series.length < 2) return null;

  const title = applyTitleContext(
    promptTopic
      ? `${promptTopic} by category`
      : subjectName
        ? `${subjectName} spending by category`
        : "Spending by category",
    buildTitleContext(subjectName, promptTopic, sourceLabel)
  );

  return validateDefinition(workspaceId, {
    kind: "chart",
    subtype: "spending",
    title,
    schema: {
      intent: "compare_categories",
      title,
      ...(sourceTableTitle ? { sourceTableTitle } : {}),
    },
    data: { series },
    metadata: sourceTableTitle ? { sourceTableTitle } : {},
  });
}

function buildDailyChart(
  workspaceId: string,
  table: ParsedTable,
  subjectName: string | null,
  sourceTableTitle?: string,
  promptTopic?: string | null,
  sourceLabel?: string | null
): AssetDefinitionInput | null {
  const dateIndex = findColumnIndex(table.headers, DATE_HEADER);
  const amountIndex = findColumnIndex(table.headers, AMOUNT_HEADER);
  if (dateIndex === -1 || amountIndex === -1) return null;

  const series = table.rows
    .map((row) => {
      const label = sanitizeTableCellValue(row[dateIndex] ?? "");
      const value = parseAmount(row[amountIndex] ?? "");
      if (!label || value === null || isSummaryRowLabel(label)) return null;
      return { label, value };
    })
    .filter((point): point is { label: string; value: number } => point !== null);

  if (series.length < 2) return null;

  const title = applyTitleContext(
    promptTopic
      ? `${promptTopic} over time`
      : subjectName
        ? `${subjectName} daily spending`
        : "Daily spending",
    buildTitleContext(subjectName, promptTopic, sourceLabel)
  );

  return validateDefinition(workspaceId, {
    kind: "chart",
    subtype: "daily",
    title,
    schema: {
      intent: "show_over_time",
      title,
      ...(sourceTableTitle ? { sourceTableTitle } : {}),
    },
    data: { series },
    metadata: sourceTableTitle ? { sourceTableTitle } : {},
  });
}

function buildPaymentDashboard(
  workspaceId: string,
  table: ParsedTable,
  subjectName: string | null,
  categoryChart: AssetDefinitionInput | null,
  promptTopic?: string | null,
  sourceLabel?: string | null
): AssetDefinitionInput | null {
  const labelIndex = findColumnIndex(table.headers, LABEL_HEADER);
  const amountIndex = findColumnIndex(table.headers, AMOUNT_HEADER);
  if (labelIndex === -1 || amountIndex === -1) return null;

  const metrics: Record<string, number> = {};
  for (const row of table.rows) {
    const label = row[labelIndex]?.trim() ?? "";
    const value = parseAmount(row[amountIndex] ?? "");
    if (!label || value === null) continue;
    if (!PAYMENT_LABEL.test(label)) continue;

    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    metrics[key] = value;
  }

  if (Object.keys(metrics).length === 0) return null;

  const title = applyTitleContext(
    promptTopic
      ? `${promptTopic} dashboard`
      : subjectName
        ? `${subjectName} spending dashboard`
        : "Spending dashboard",
    buildTitleContext(subjectName, promptTopic, sourceLabel)
  );
  const widgets: Array<Record<string, unknown>> = Object.entries(metrics).map(([key, _value]) => ({
    type: "metric",
    title: key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    dataKey: key,
  }));

  if (categoryChart) {
    widgets.push({
      type: "viz",
      intent: "compare_categories",
      title: categoryChart.title,
    });
  }

  return validateDefinition(workspaceId, {
    kind: "dashboard",
    subtype: "spending",
    title,
    schema: { widgets },
    data: { metrics },
  });
}

export function extractAssetsFromChatAnalysis(input: {
  chatText: string;
  userInput: string;
  workspaceId: string;
  attachmentFilename?: string | null;
}): AssetDefinitionInput[] {
  const sanitized = sanitizeAnalysisTextForParsing(input.chatText);
  const tables = parseTablesFromChat(sanitized).filter((table) => !isAsciiVizTable(table));
  if (tables.length === 0) return [];

  const subjectName = extractSubjectName(sanitized, input.userInput);
  const promptTopic = extractPromptTopic(input.userInput);
  const sourceLabel = input.attachmentFilename
    ? stripFilenameExtension(input.attachmentFilename)
    : null;
  const definitions: AssetDefinitionInput[] = [];
  const tableTitles: string[] = [];

  for (const [index, table] of tables.entries()) {
    const tableAssets = buildTableAssetsFromParsedTable(
      input.workspaceId,
      table,
      subjectName,
      index,
      promptTopic,
      sourceLabel
    );
    for (const tableAsset of tableAssets) {
      definitions.push(tableAsset);
    }
    const primarySheet =
      tableAssets.find((asset) => !asset.title.includes("Payment status")) ?? tableAssets[0];
    tableTitles[index] = primarySheet?.title ?? "";
  }

  let categoryChart: AssetDefinitionInput | null = null;
  let dailyChart: AssetDefinitionInput | null = null;
  let paymentDashboard: AssetDefinitionInput | null = null;

  for (const [index, table] of tables.entries()) {
    const sourceTableTitle = tableTitles[index];
    if (!categoryChart) {
      categoryChart = buildCategoryChart(
        input.workspaceId,
        table,
        subjectName,
        sourceTableTitle,
        promptTopic,
        sourceLabel
      );
    }
    if (!dailyChart) {
      dailyChart = buildDailyChart(
        input.workspaceId,
        table,
        subjectName,
        sourceTableTitle,
        promptTopic,
        sourceLabel
      );
    }
    if (!paymentDashboard) {
      paymentDashboard = buildPaymentDashboard(
        input.workspaceId,
        table,
        subjectName,
        categoryChart,
        promptTopic,
        sourceLabel
      );
    }
  }

  if (categoryChart) definitions.push(categoryChart);
  if (dailyChart && dailyChart.title !== categoryChart?.title) {
    definitions.push(dailyChart);
  }
  if (paymentDashboard) definitions.push(paymentDashboard);

  return definitions;
}
