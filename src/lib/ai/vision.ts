import { getMoonshotConfig } from "@/lib/ai/config";
import { uploadMoonshotFile } from "@/lib/ai/files";
import type {
  AttachmentInput,
  KimiContentPart,
  KimiImagePart,
  KimiVideoPart,
  ResolvedVisionPart,
  ResolvedVisionResult,
} from "@/lib/ai/types";

export const SUPPORTED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export const SUPPORTED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-flv",
  "video/webm",
  "video/x-ms-wmv",
  "video/3gpp",
  "video/avi",
  "video/mov",
  "video/mpg",
]);

export function isSupportedVisionMime(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase();
  return SUPPORTED_IMAGE_MIMES.has(normalized) || SUPPORTED_VIDEO_MIMES.has(normalized);
}

export function isImageMime(mimeType: string): boolean {
  return SUPPORTED_IMAGE_MIMES.has(mimeType.toLowerCase());
}

export function isVideoMime(mimeType: string): boolean {
  return SUPPORTED_VIDEO_MIMES.has(mimeType.toLowerCase());
}

function mimeToDataUrlSubtype(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized === "image/jpg") return "jpeg";
  if (normalized.startsWith("image/")) return normalized.slice("image/".length);
  if (normalized.startsWith("video/")) return normalized.slice("video/".length);
  return normalized;
}

export function toDataUrl(buffer: Buffer | Uint8Array, mimeType: string): string {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const subtype = mimeToDataUrlSubtype(mimeType);
  const kind = isVideoMime(mimeType) ? "video" : "image";
  return `data:${kind}/${subtype};base64,${bytes.toString("base64")}`;
}

export function buildImagePart(buffer: Buffer | Uint8Array, mimeType: string): KimiImagePart {
  return {
    type: "image_url",
    image_url: { url: toDataUrl(buffer, mimeType) },
  };
}

export function buildVideoPart(buffer: Buffer | Uint8Array, mimeType: string): KimiVideoPart {
  return {
    type: "video_url",
    video_url: { url: toDataUrl(buffer, mimeType) },
  };
}

export function buildMoonshotFilePart(
  fileId: string,
  kind: "image" | "video"
): KimiImagePart | KimiVideoPart {
  const url = `ms://${fileId}`;
  if (kind === "video") {
    return { type: "video_url", video_url: { url } };
  }
  return { type: "image_url", image_url: { url } };
}

export function buildVisionUserContent(options: {
  text: string;
  parts: ResolvedVisionPart[];
}): KimiContentPart[] {
  return [...options.parts, { type: "text", text: options.text }];
}

function shouldUploadInline(input: AttachmentInput, inlineMaxBytes: number): boolean {
  const size = input.buffer.byteLength;
  if (isVideoMime(input.mimeType)) return false;
  if (!isImageMime(input.mimeType)) return false;
  return size <= inlineMaxBytes;
}

export async function resolveVisionInput(input: AttachmentInput): Promise<ResolvedVisionResult> {
  if (!isSupportedVisionMime(input.mimeType)) {
    throw new Error(`Unsupported vision mime type: ${input.mimeType}`);
  }

  const { visionInlineMaxBytes } = getMoonshotConfig();

  if (shouldUploadInline(input, visionInlineMaxBytes)) {
    return {
      part: buildImagePart(input.buffer, input.mimeType),
      fileId: null,
    };
  }

  const purpose = isVideoMime(input.mimeType) ? "video" : "image";
  const uploaded = await uploadMoonshotFile({
    buffer: input.buffer,
    filename: input.filename,
    purpose,
  });

  return {
    part: buildMoonshotFilePart(uploaded.id, isVideoMime(input.mimeType) ? "video" : "image"),
    fileId: uploaded.id,
  };
}

export async function resolveVisionInputs(inputs: AttachmentInput[]): Promise<ResolvedVisionResult[]> {
  return Promise.all(inputs.map((input) => resolveVisionInput(input)));
}

export async function buildVisionUserMessageFromInputs(options: {
  userInput: string;
  visionInputs: AttachmentInput[];
}): Promise<{ content: KimiContentPart[]; uploadedFileIds: string[] }> {
  if (options.visionInputs.length === 0) {
    return {
      content: [{ type: "text", text: options.userInput }],
      uploadedFileIds: [],
    };
  }

  const resolved = await resolveVisionInputs(options.visionInputs);
  const uploadedFileIds = resolved
    .map((item) => item.fileId)
    .filter((fileId): fileId is string => fileId !== null);

  return {
    content: buildVisionUserContent({
      text: options.userInput,
      parts: resolved.map((item) => item.part),
    }),
    uploadedFileIds,
  };
}
