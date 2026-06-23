import "server-only";

import type { LedgerScope } from "@/lib/ledger/scope";
import {
  buildStorageRef,
  getUploadsBucket,
  parseStorageRef,
  sanitizeUploadFilename,
} from "@/lib/storage/storage-ref";

const SIGNED_URL_TTL_SECONDS = 3600;

export { buildStorageRef, getUploadsBucket, parseStorageRef } from "@/lib/storage/storage-ref";

export type UploadedWorkspaceFile = {
  bucket: string;
  path: string;
  storageRef: string;
};

export async function uploadWorkspaceFile(
  scope: LedgerScope,
  input: {
    workspaceId: string;
    assetId: string;
    buffer: Buffer | Uint8Array;
    filename: string;
    mimeType: string;
  }
): Promise<UploadedWorkspaceFile> {
  const bucket = getUploadsBucket();
  const sanitized = sanitizeUploadFilename(input.filename);
  const path = `${scope.ledgerKey}/${input.workspaceId}/${input.assetId}/${sanitized}`;
  const body = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(input.buffer);

  const { error } = await scope.supabase.storage.from(bucket).upload(path, body, {
    contentType: input.mimeType || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return { bucket, path, storageRef: buildStorageRef(bucket, path) };
}

export async function createSignedDownloadUrl(
  scope: LedgerScope,
  storageRef: string,
  expiresIn = SIGNED_URL_TTL_SECONDS
): Promise<string> {
  const parsed = parseStorageRef(storageRef);
  if (!parsed) {
    throw new Error("Invalid storage reference");
  }

  const { data, error } = await scope.supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to create signed URL");
  }

  return data.signedUrl;
}

export async function downloadWorkspaceFile(
  scope: LedgerScope,
  storageRef: string
): Promise<Buffer> {
  const parsed = parseStorageRef(storageRef);
  if (!parsed) {
    throw new Error("Invalid storage reference");
  }

  const { data, error } = await scope.supabase.storage.from(parsed.bucket).download(parsed.path);

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to download file");
  }

  return Buffer.from(await data.arrayBuffer());
}
