const DEFAULT_BUCKET = "ledger-uploads";

export function getUploadsBucket(): string {
  return process.env.SUPABASE_UPLOADS_BUCKET?.trim() || DEFAULT_BUCKET;
}

export function buildStorageRef(bucket: string, path: string): string {
  return `supabase://${bucket}/${path}`;
}

export function parseStorageRef(storageRef: string): { bucket: string; path: string } | null {
  if (!storageRef.startsWith("supabase://")) return null;
  const rest = storageRef.slice("supabase://".length);
  const slashIndex = rest.indexOf("/");
  if (slashIndex <= 0) return null;
  return {
    bucket: rest.slice(0, slashIndex),
    path: rest.slice(slashIndex + 1),
  };
}

export function sanitizeUploadFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || "file";
  return base.replace(/[^\w.\-()+ ]/g, "_").slice(0, 200) || "file";
}
