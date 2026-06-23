import { toFile } from "openai/uploads";
import type OpenAI from "openai";

import { getMoonshotConfig, MOONSHOT_MAX_FILE_BYTES } from "@/lib/ai/config";
import { createMoonshotClient } from "@/lib/ai/moonshot-client";
import { withRetry } from "@/lib/ai/retry";
import type { MoonshotFilePurpose } from "@/lib/ai/types";

export type UploadMoonshotFileOptions = {
  buffer: Buffer | Uint8Array;
  filename: string;
  purpose: MoonshotFilePurpose;
};

export type MoonshotUploadedFile = {
  id: string;
  msUrl: string;
  purpose: MoonshotFilePurpose;
  filename: string;
};

export type MoonshotFileMetadata = {
  id: string;
  filename: string;
  purpose: string;
  status: string;
  bytes: number;
};

function toBuffer(input: Buffer | Uint8Array): Buffer {
  return Buffer.isBuffer(input) ? input : Buffer.from(input);
}

export function assertFileSizeWithinLimit(buffer: Buffer | Uint8Array, filename: string): void {
  const maxBytes = getMoonshotConfig().maxFileBytes;
  const size = buffer.byteLength;
  if (size > maxBytes) {
    throw new Error(
      `File "${filename}" exceeds Moonshot limit (${size} bytes > ${maxBytes} bytes).`
    );
  }
}

export async function uploadMoonshotFile(
  options: UploadMoonshotFileOptions
): Promise<MoonshotUploadedFile> {
  assertFileSizeWithinLimit(options.buffer, options.filename);

  return withRetry(async () => {
    const client = createMoonshotClient();
    const file = await toFile(toBuffer(options.buffer), options.filename);
    const created = await client.files.create({
      file,
      purpose: options.purpose,
    } as unknown as OpenAI.Files.FileCreateParams);

    return {
      id: created.id,
      msUrl: `ms://${created.id}`,
      purpose: options.purpose,
      filename: options.filename,
    };
  });
}

export async function getMoonshotFileMetadata(fileId: string): Promise<MoonshotFileMetadata> {
  return withRetry(async () => {
    const client = createMoonshotClient();
    const file = await client.files.retrieve(fileId);
    return {
      id: file.id,
      filename: file.filename,
      purpose: file.purpose,
      status: file.status,
      bytes: file.bytes,
    };
  });
}

function isFileReadyStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "ok" || normalized === "ready" || normalized === "processed";
}

export async function waitForMoonshotFileReady(
  fileId: string,
  timeoutMs?: number
): Promise<MoonshotFileMetadata> {
  const config = getMoonshotConfig();
  const deadline = Date.now() + (timeoutMs ?? config.fileReadyTimeoutMs);
  const pollIntervalMs = 500;

  while (Date.now() < deadline) {
    const metadata = await getMoonshotFileMetadata(fileId);
    if (isFileReadyStatus(metadata.status)) {
      return metadata;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for Moonshot file ${fileId} to become ready.`);
}

export async function getMoonshotFileContent(fileId: string): Promise<string> {
  return withRetry(async () => {
    const client = createMoonshotClient();
    const response = await client.files.content(fileId);
    return response.text();
  });
}

export async function listMoonshotFiles(): Promise<MoonshotFileMetadata[]> {
  return withRetry(async () => {
    const client = createMoonshotClient();
    const list = await client.files.list();
    return list.data.map((file) => ({
      id: file.id,
      filename: file.filename,
      purpose: file.purpose,
      status: file.status,
      bytes: file.bytes,
    }));
  });
}

export async function deleteMoonshotFile(fileId: string): Promise<void> {
  return withRetry(async () => {
    const client = createMoonshotClient();
    await client.files.delete(fileId);
  });
}

export async function deleteMoonshotFiles(fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return;

  const uniqueIds = [...new Set(fileIds)];
  await Promise.allSettled(uniqueIds.map((fileId) => deleteMoonshotFile(fileId)));
}

export async function cleanupMoonshotFilesIfEnabled(fileIds: string[]): Promise<void> {
  if (!getMoonshotConfig().autoDeleteFiles) return;
  await deleteMoonshotFiles(fileIds);
}
