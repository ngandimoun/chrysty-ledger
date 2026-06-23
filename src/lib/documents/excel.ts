import "server-only";

import ExcelJS from "exceljs";

export async function readWorkbookFromBuffer(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook;
}

export async function workbookToBuffer(workbook: ExcelJS.Workbook) {
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function sheetToRows(
  workbook: ExcelJS.Workbook,
  sheetName?: string
): Promise<Record<string, string>[]> {
  const sheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? `Column ${colNumber}`);
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      const cell = row.getCell(index + 1);
      record[header] = cell.value == null ? "" : String(cell.value);
    });
    rows.push(record);
  });

  return rows;
}

export async function rowsToWorkbookBuffer(
  sheetName: string,
  columns: string[],
  rows: Record<string, string>[]
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(columns);
  for (const row of rows) {
    sheet.addRow(columns.map((column) => row[column] ?? ""));
  }
  return workbookToBuffer(workbook);
}
