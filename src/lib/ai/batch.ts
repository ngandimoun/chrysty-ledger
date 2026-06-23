import type OpenAI from "openai";

import { getMoonshotConfig, requireMoonshotConfig } from "@/lib/ai/config";
import {
  getMoonshotFileContent,
  uploadMoonshotFile,
} from "@/lib/ai/files";
import { createMoonshotClient } from "@/lib/ai/moonshot-client";
import { withRetry } from "@/lib/ai/retry";
import type {
  BatchChatCompletionLine,
  BatchOutputLine,
  MoonshotBatchJob,
  MoonshotBatchStatus,
  ParsedBatchOutputLine,
} from "@/lib/ai/types";

const BATCH_ENDPOINT = "/v1/chat/completions" as const;

const TERMINAL_BATCH_STATUSES = new Set<MoonshotBatchStatus>([
  "completed",
  "failed",
  "expired",
  "cancelled",
]);

export type CreateMoonshotBatchOptions = {
  inputFileId: string;
  completionWindow?: string;
  metadata?: Record<string, string>;
};

export type ListMoonshotBatchesOptions = {
  after?: string;
  limit?: number;
};

export type PollMoonshotBatchOptions = {
  pollIntervalMs?: number;
  signal?: AbortSignal;
  onProgress?: (job: MoonshotBatchJob) => void;
};

function mapBatchJob(batch: OpenAI.Batches.Batch): MoonshotBatchJob {
  return {
    id: batch.id,
    object: "batch",
    endpoint: batch.endpoint,
    input_file_id: batch.input_file_id,
    completion_window: batch.completion_window,
    status: batch.status as MoonshotBatchStatus,
    output_file_id: batch.output_file_id ?? null,
    error_file_id: batch.error_file_id ?? null,
    created_at: batch.created_at,
    in_progress_at: batch.in_progress_at ?? null,
    expires_at: batch.expires_at ?? null,
    finalizing_at: batch.finalizing_at ?? null,
    completed_at: batch.completed_at ?? null,
    failed_at: batch.failed_at ?? null,
    cancelling_at: batch.cancelling_at ?? null,
    cancelled_at: batch.cancelled_at ?? null,
    request_counts: {
      completed: batch.request_counts?.completed ?? 0,
      failed: batch.request_counts?.failed ?? 0,
      total: batch.request_counts?.total ?? 0,
    },
    metadata: batch.metadata ?? null,
  };
}

export function buildBatchRequestLine(
  customId: string,
  body: Record<string, unknown>
): BatchChatCompletionLine {
  return {
    custom_id: customId,
    method: "POST",
    url: BATCH_ENDPOINT,
    body,
  };
}

export function serializeBatchJsonl(lines: BatchChatCompletionLine[]): string {
  if (lines.length === 0) {
    throw new Error("Batch JSONL must contain at least one request line.");
  }

  const customIds = new Set<string>();
  for (const line of lines) {
    if (customIds.has(line.custom_id)) {
      throw new Error(`Duplicate batch custom_id: "${line.custom_id}".`);
    }
    customIds.add(line.custom_id);
  }

  return `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;
}

export async function uploadBatchInputFile(jsonl: string): Promise<string> {
  const buffer = Buffer.from(jsonl, "utf-8");
  const uploaded = await uploadMoonshotFile({
    buffer,
    filename: `batch-input-${Date.now()}.jsonl`,
    purpose: "batch",
  });
  return uploaded.id;
}

export async function createMoonshotBatch(
  options: CreateMoonshotBatchOptions
): Promise<MoonshotBatchJob> {
  return withRetry(async () => {
    const config = requireMoonshotConfig();
    const client = createMoonshotClient();

    const completionWindow = options.completionWindow ?? config.batchCompletionWindow;

    const batch = await client.batches.create({
      input_file_id: options.inputFileId,
      endpoint: BATCH_ENDPOINT,
      completion_window: completionWindow,
      ...(options.metadata ? { metadata: options.metadata } : {}),
    } as OpenAI.Batches.BatchCreateParams);

    return mapBatchJob(batch);
  });
}

export async function retrieveMoonshotBatch(batchId: string): Promise<MoonshotBatchJob> {
  return withRetry(async () => {
    const client = createMoonshotClient();
    const batch = await client.batches.retrieve(batchId);
    return mapBatchJob(batch);
  });
}

export async function listMoonshotBatches(
  options: ListMoonshotBatchesOptions = {}
): Promise<{ data: MoonshotBatchJob[]; hasMore: boolean }> {
  return withRetry(async () => {
    const client = createMoonshotClient();
    const page = await client.batches.list({
      after: options.after,
      limit: options.limit,
    });

    return {
      data: page.data.map(mapBatchJob),
      hasMore: page.has_more,
    };
  });
}

export async function cancelMoonshotBatch(batchId: string): Promise<MoonshotBatchJob> {
  return withRetry(async () => {
    const client = createMoonshotClient();
    const batch = await client.batches.cancel(batchId);
    return mapBatchJob(batch);
  });
}

export function isTerminalBatchStatus(status: MoonshotBatchStatus): boolean {
  return TERMINAL_BATCH_STATUSES.has(status);
}

export async function pollMoonshotBatchUntilTerminal(
  batchId: string,
  options: PollMoonshotBatchOptions = {}
): Promise<MoonshotBatchJob> {
  const config = getMoonshotConfig();
  const pollIntervalMs = options.pollIntervalMs ?? config.batchPollIntervalMs;

  while (true) {
    if (options.signal?.aborted) {
      throw new Error("Batch polling aborted.");
    }

    const job = await retrieveMoonshotBatch(batchId);
    options.onProgress?.(job);

    if (isTerminalBatchStatus(job.status)) {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

export async function downloadBatchOutputFile(fileId: string): Promise<string> {
  return getMoonshotFileContent(fileId);
}

export function parseBatchOutputLine(line: string): ParsedBatchOutputLine {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new Error("Cannot parse empty batch output line.");
  }

  let parsed: BatchOutputLine;
  try {
    parsed = JSON.parse(trimmed) as BatchOutputLine;
  } catch (error) {
    throw new Error(
      `Invalid batch output JSON line: ${error instanceof Error ? error.message : "parse error"}`
    );
  }

  const customId = parsed.custom_id;
  if (!customId) {
    throw new Error("Batch output line is missing custom_id.");
  }

  if (parsed.error) {
    return {
      customId,
      success: false,
      content: null,
      statusCode: parsed.response?.status_code ?? null,
      error: parsed.error.message ?? "Batch request failed.",
    };
  }

  const statusCode = parsed.response?.status_code ?? null;
  const content = parsed.response?.body?.choices?.[0]?.message?.content ?? null;

  if (statusCode !== 200 || !content?.trim()) {
    return {
      customId,
      success: false,
      content,
      statusCode,
      error: content ? "Empty batch response content." : "Batch request returned no content.",
    };
  }

  return {
    customId,
    success: true,
    content,
    statusCode,
    error: null,
  };
}

export function parseBatchOutputJsonl(text: string): ParsedBatchOutputLine[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map(parseBatchOutputLine);
}
