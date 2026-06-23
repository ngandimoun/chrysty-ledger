import type { KimiOfficialFormulaShortName } from "@/lib/ai/official-tools";
import { isImageMime } from "@/lib/ai/vision";
import { shouldRouteToFileExtract } from "@/lib/ai/file-extract";
import type { AttachmentInput } from "@/lib/ai/types";
import type { Asset } from "@/lib/assets/asset";
import type { AgentAction } from "@/lib/agent-actions/types";

const SPREADSHEET_MIMES = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const SPREADSHEET_EXTENSIONS = [".csv", ".xls", ".xlsx"];

function hasSpreadsheet(attachments: AttachmentInput[]): boolean {
  return attachments.some((file) => {
    if (SPREADSHEET_MIMES.has(file.mimeType.toLowerCase())) return true;
    const ext = file.filename.slice(file.filename.lastIndexOf(".")).toLowerCase();
    return SPREADSHEET_EXTENSIONS.includes(ext);
  });
}

function hasImages(attachments: AttachmentInput[]): boolean {
  return attachments.some((file) => isImageMime(file.mimeType));
}

function hasDocuments(attachments: AttachmentInput[]): boolean {
  return attachments.some((file) => shouldRouteToFileExtract(file));
}

function uniqueTools(tools: KimiOfficialFormulaShortName[]): KimiOfficialFormulaShortName[] {
  return [...new Set(tools)];
}

export function inferToolsForImport(attachments: AttachmentInput[]): KimiOfficialFormulaShortName[] {
  const tools: KimiOfficialFormulaShortName[] = ["date"];

  if (hasSpreadsheet(attachments)) {
    tools.push("excel");
  }

  if (hasDocuments(attachments) && !hasSpreadsheet(attachments)) {
    tools.push("excel", "code_runner");
  }

  if (hasImages(attachments)) {
    tools.push("excel", "date");
  }

  if (attachments.length > 1) {
    tools.push("excel", "code_runner", "date");
  }

  return uniqueTools(tools);
}

export function inferToolsForTransform(_source: Asset): KimiOfficialFormulaShortName[] {
  return ["code_runner", "excel", "quickjs", "date"];
}

export function inferToolsForAnalyze(sources: Asset[]): KimiOfficialFormulaShortName[] {
  const hasTable = sources.some((a) => a.kind === "table");
  if (hasTable) {
    return ["code_runner", "excel", "quickjs"];
  }
  return ["code_runner", "excel"];
}

export function resolveToolsForStep(
  action: AgentAction,
  options: {
    stepTools?: KimiOfficialFormulaShortName[];
    attachments?: AttachmentInput[];
    sourceAssets?: Asset[];
  }
): KimiOfficialFormulaShortName[] {
  if (options.stepTools?.length) {
    return uniqueTools(options.stepTools);
  }

  switch (action) {
    case "import":
      return inferToolsForImport(options.attachments ?? []);
    case "transform":
      return inferToolsForTransform(options.sourceAssets?.[0] ?? ({} as Asset));
    case "analyze":
      return inferToolsForAnalyze(options.sourceAssets ?? []);
    default:
      return [];
  }
}
