import type { WorkspaceArtifact } from "@/lib/artifact-types";
import { prepareAttachments } from "@/lib/ai/attachment-routing";
import {
  createMoonshotBatch,
  downloadBatchOutputFile,
  parseBatchOutputJsonl,
  pollMoonshotBatchUntilTerminal,
  serializeBatchJsonl,
  uploadBatchInputFile,
} from "@/lib/ai/batch";
import { getMoonshotConfig } from "@/lib/ai/config";
import { deleteMoonshotFiles } from "@/lib/ai/files";
import { buildBatchChatCompletionBody } from "@/lib/ai/moonshot";
import { buildExtractionMessages } from "@/lib/ai/prompts";
import {
  isReceiptExtractionJson,
  JSON_RESPONSE_FORMAT,
  parseJsonCompletion,
  receiptJsonToTableArtifact,
} from "@/lib/ai/response-modes";
import type {
  AttachmentInput,
  BatchChatCompletionLine,
  LedgerBulkExtractionItem,
  LedgerBulkExtractionPerFileResult,
  LedgerBulkExtractionResult,
  ReceiptExtractionJson,
} from "@/lib/ai/types";

export type BuildLedgerExtractionBatchLinesOptions = {
  items: LedgerBulkExtractionItem[];
  maxTokens?: number;
};

export type BuildLedgerExtractionBatchLinesResult = {
  lines: BatchChatCompletionLine[];
  uploadedFileIds: string[];
  customIdToFilename: Map<string, string>;
};

export type SubmitLedgerExtractionBatchOptions = BuildLedgerExtractionBatchLinesOptions & {
  completionWindow?: string;
  metadata?: Record<string, string>;
};

export type SubmitLedgerExtractionBatchResult = {
  batchId: string;
  inputFileId: string;
  uploadedFileIds: string[];
  customIdToFilename: Map<string, string>;
};

export type RunLedgerBulkExtractionOptions = SubmitLedgerExtractionBatchOptions & {
  pollIntervalMs?: number;
  signal?: AbortSignal;
  onProgress?: (job: import("@/lib/ai/types").MoonshotBatchJob) => void;
  cleanupFiles?: boolean;
};

function sanitizeCustomId(value: string, index: number): string {
  const base = value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base || `receipt-${index}`;
}

function buildCustomId(item: LedgerBulkExtractionItem, index: number): string {
  return sanitizeCustomId(item.customId ?? item.attachment.filename, index);
}

export async function buildLedgerExtractionBatchLines(
  options: BuildLedgerExtractionBatchLinesOptions
): Promise<BuildLedgerExtractionBatchLinesResult> {
  if (options.items.length === 0) {
    throw new Error("At least one attachment is required for ledger batch extraction.");
  }

  const config = getMoonshotConfig();
  const lines: BatchChatCompletionLine[] = [];
  const uploadedFileIds: string[] = [];
  const customIdToFilename = new Map<string, string>();

  for (const [index, item] of options.items.entries()) {
    const customId = buildCustomId(item, index);
    customIdToFilename.set(customId, item.attachment.filename);

    const prepared = await prepareAttachments([item.attachment]);
    uploadedFileIds.push(...prepared.uploadedFileIds);

    const messages = await buildExtractionMessages({
      userInput: item.userInput ?? "Extract all transactions from this document.",
      fileSystemMessages: prepared.fileSystemMessages,
      visionInputs: prepared.visionInputs,
      onVisionUploaded: (fileIds) => {
        uploadedFileIds.push(...fileIds);
      },
    });

    const body = buildBatchChatCompletionBody({
      messages,
      model: config.model,
      maxTokens: options.maxTokens ?? config.batchMaxTokens,
      responseFormat: JSON_RESPONSE_FORMAT,
    });

    lines.push({
      custom_id: customId,
      method: "POST",
      url: "/v1/chat/completions",
      body,
    });
  }

  return { lines, uploadedFileIds, customIdToFilename };
}

export function mergeReceiptExtractions(
  results: Array<{ data?: ReceiptExtractionJson }>
): ReceiptExtractionJson {
  const transactions = results.flatMap((result) => result.data?.transactions ?? []);
  const summaries = results
    .map((result) => result.data?.summary?.trim())
    .filter((summary): summary is string => Boolean(summary));

  const deduped: ReceiptExtractionJson["transactions"] = [];
  const seen = new Set<string>();

  for (const row of transactions) {
    const key = `${row.date}|${row.vendor}|${row.amount}|${row.category}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  const summary =
    summaries.length > 0
      ? summaries.join(" ")
      : `${deduped.length} transaction${deduped.length === 1 ? "" : "s"} extracted from batch.`;

  return {
    transactions: deduped,
    summary,
  };
}

export function buildBulkExtractionSummary(
  merged: ReceiptExtractionJson,
  perFile: LedgerBulkExtractionPerFileResult[]
): string {
  const successCount = perFile.filter((file) => file.success).length;
  const vendorCount = new Set(
    merged.transactions.map((row) => row.vendor.trim().toLowerCase()).filter(Boolean)
  ).size;

  const amountTotal = merged.transactions.reduce((sum, row) => {
    const numeric = Number.parseFloat(row.amount.replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(numeric) ? sum + numeric : sum;
  }, 0);

  const amountLabel =
    amountTotal > 0
      ? `$${amountTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : "amounts pending review";

  return `${successCount} receipt${successCount === 1 ? "" : "s"} • ${amountLabel} in expenses • ${vendorCount} vendor${vendorCount === 1 ? "" : "s"}`;
}

export async function submitLedgerExtractionBatch(
  options: SubmitLedgerExtractionBatchOptions
): Promise<SubmitLedgerExtractionBatchResult> {
  const { lines, uploadedFileIds, customIdToFilename } =
    await buildLedgerExtractionBatchLines(options);

  const jsonl = serializeBatchJsonl(lines);
  const inputFileId = await uploadBatchInputFile(jsonl);
  uploadedFileIds.push(inputFileId);

  const batch = await createMoonshotBatch({
    inputFileId,
    completionWindow: options.completionWindow,
    metadata: options.metadata,
  });

  return {
    batchId: batch.id,
    inputFileId,
    uploadedFileIds: [...new Set(uploadedFileIds)],
    customIdToFilename,
  };
}

function parsePerFileResults(
  outputLines: ReturnType<typeof parseBatchOutputJsonl>,
  customIdToFilename: Map<string, string>
): LedgerBulkExtractionPerFileResult[] {
  return outputLines.map((line) => {
    const filename = customIdToFilename.get(line.customId) ?? line.customId;

    if (!line.success || !line.content) {
      return {
        customId: line.customId,
        filename,
        success: false,
        error: line.error ?? "Batch line failed.",
      };
    }

    try {
      const parsed = parseJsonCompletion<Record<string, unknown>>(line.content);
      if (!isReceiptExtractionJson(parsed)) {
        return {
          customId: line.customId,
          filename,
          success: false,
          error: "Batch response did not match receipt extraction schema.",
        };
      }

      return {
        customId: line.customId,
        filename,
        success: true,
        data: parsed,
      };
    } catch (error) {
      return {
        customId: line.customId,
        filename,
        success: false,
        error: error instanceof Error ? error.message : "Failed to parse batch JSON.",
      };
    }
  });
}

export async function runLedgerBulkExtraction(
  options: RunLedgerBulkExtractionOptions
): Promise<LedgerBulkExtractionResult> {
  const config = getMoonshotConfig();
  const shouldCleanup = options.cleanupFiles ?? config.autoDeleteFiles;

  const submission = await submitLedgerExtractionBatch(options);
  const fileIdsToCleanup = [...submission.uploadedFileIds];

  try {
    const job = await pollMoonshotBatchUntilTerminal(submission.batchId, {
      pollIntervalMs: options.pollIntervalMs,
      signal: options.signal,
      onProgress: options.onProgress,
    });

    if (job.status !== "completed") {
      throw new Error(`Ledger batch extraction ended with status "${job.status}".`);
    }

    if (!job.output_file_id) {
      throw new Error("Completed batch job is missing output_file_id.");
    }

    if (job.output_file_id) {
      fileIdsToCleanup.push(job.output_file_id);
    }
    if (job.error_file_id) {
      fileIdsToCleanup.push(job.error_file_id);
    }

    const outputText = await downloadBatchOutputFile(job.output_file_id);
    const outputLines = parseBatchOutputJsonl(outputText);

    const perFile = parsePerFileResults(outputLines, submission.customIdToFilename);
    const merged = mergeReceiptExtractions(perFile);
    const tableArtifact: WorkspaceArtifact = receiptJsonToTableArtifact(merged);
    const summaryText = buildBulkExtractionSummary(merged, perFile);

    return {
      batchId: submission.batchId,
      perFile,
      merged,
      tableArtifact,
      summaryText,
      uploadedFileIds: [...new Set(fileIdsToCleanup)],
    };
  } finally {
    if (shouldCleanup) {
      await deleteMoonshotFiles(fileIdsToCleanup);
    }
  }
}

export type { AttachmentInput, LedgerBulkExtractionItem, LedgerBulkExtractionResult };
