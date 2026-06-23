import "server-only";

import * as XLSX from "xlsx";

export function parseXlsxBuffer(buffer: Buffer) {
  return XLSX.read(buffer, { type: "buffer" });
}

export function sheetToJson<T extends Record<string, unknown>>(
  workbook: XLSX.WorkBook,
  sheetName?: string
): T[] {
  const name = sheetName ?? workbook.SheetNames[0];
  if (!name) return [];
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<T>(sheet);
}

export function jsonToXlsxBuffer(
  sheetName: string,
  rows: Record<string, unknown>[]
): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  const output = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(output);
}
