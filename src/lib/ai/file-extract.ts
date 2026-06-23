import {
  assertFileSizeWithinLimit,
  getMoonshotFileContent,
  uploadMoonshotFile,
  waitForMoonshotFileReady,
} from "@/lib/ai/files";
import { isImageMime, isVideoMime } from "@/lib/ai/vision";
import type { AttachmentInput, KimiMessage } from "@/lib/ai/types";

export const SUPPORTED_EXTRACT_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".csv",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".md",
  ".html",
  ".json",
  ".xml",
  ".rtf",
  ".log",
  ".yaml",
  ".yml",
  ".epub",
  ".mobi",
]);

export const SUPPORTED_EXTRACT_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/markdown",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
  "application/rtf",
  "application/epub+zip",
]);

function getExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  if (index === -1) return "";
  return filename.slice(index).toLowerCase();
}

export function isFileExtractMime(mimeType: string, filename: string): boolean {
  const normalized = mimeType.toLowerCase();
  if (SUPPORTED_EXTRACT_MIMES.has(normalized)) return true;
  return SUPPORTED_EXTRACT_EXTENSIONS.has(getExtension(filename));
}

export function shouldRouteToFileExtract(input: AttachmentInput): boolean {
  if (isVideoMime(input.mimeType)) return false;
  if (isImageMime(input.mimeType)) return false;
  return isFileExtractMime(input.mimeType, input.filename);
}

export function shouldRouteToVision(input: AttachmentInput): boolean {
  return isImageMime(input.mimeType);
}

export async function uploadExtractAndBuildSystemMessage(
  input: AttachmentInput
): Promise<{ fileId: string; systemMessage: KimiMessage }> {
  assertFileSizeWithinLimit(input.buffer, input.filename);

  const uploaded = await uploadMoonshotFile({
    buffer: input.buffer,
    filename: input.filename,
    purpose: "file-extract",
  });

  await waitForMoonshotFileReady(uploaded.id);
  const extractedContent = await getMoonshotFileContent(uploaded.id);

  return {
    fileId: uploaded.id,
    systemMessage: {
      role: "system",
      content: extractedContent,
    },
  };
}

export async function extractFilesToSystemMessages(
  inputs: AttachmentInput[]
): Promise<{ fileIds: string[]; systemMessages: KimiMessage[] }> {
  const fileIds: string[] = [];
  const systemMessages: KimiMessage[] = [];

  for (const input of inputs) {
    const extracted = await uploadExtractAndBuildSystemMessage(input);
    fileIds.push(extracted.fileId);
    systemMessages.push(extracted.systemMessage);
  }

  return { fileIds, systemMessages };
}
