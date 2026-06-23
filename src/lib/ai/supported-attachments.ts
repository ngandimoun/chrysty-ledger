import { MOONSHOT_MAX_FILE_BYTES } from "@/lib/ai/config";
import {
  SUPPORTED_EXTRACT_EXTENSIONS,
  SUPPORTED_EXTRACT_MIMES,
} from "@/lib/ai/file-extract";
import { SUPPORTED_IMAGE_MIMES, isVideoMime } from "@/lib/ai/vision";

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mpeg",
  ".mpg",
  ".mov",
  ".avi",
  ".webm",
  ".flv",
  ".wmv",
  ".3gp",
  ".mkv",
]);

export type AttachmentCandidate = {
  name: string;
  type: string;
  size: number;
};

function getExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  if (index === -1) return "";
  return filename.slice(index).toLowerCase();
}

export function isVideoAttachment(candidate: AttachmentCandidate): boolean {
  if (candidate.type.toLowerCase().startsWith("video/")) return true;
  if (isVideoMime(candidate.type)) return true;
  return VIDEO_EXTENSIONS.has(getExtension(candidate.name));
}

export function isAcceptedChatAttachment(candidate: AttachmentCandidate): boolean {
  if (isVideoAttachment(candidate)) return false;
  if (candidate.size > MOONSHOT_MAX_FILE_BYTES) return false;

  const mime = candidate.type.toLowerCase();
  if (mime.startsWith("image/") || SUPPORTED_IMAGE_MIMES.has(mime)) return true;
  if (SUPPORTED_EXTRACT_MIMES.has(mime)) return true;
  return SUPPORTED_EXTRACT_EXTENSIONS.has(getExtension(candidate.name));
}

export function getAttachmentRejectionReason(candidate: AttachmentCandidate): string | null {
  if (isVideoAttachment(candidate)) {
    return "Video files are not supported.";
  }
  if (candidate.size > MOONSHOT_MAX_FILE_BYTES) {
    return `File "${candidate.name}" exceeds the 100 MB limit.`;
  }
  if (!isAcceptedChatAttachment(candidate)) {
    return `File type not supported: "${candidate.name}".`;
  }
  return null;
}

const EXTRACT_ACCEPT_EXTENSIONS = [...SUPPORTED_EXTRACT_EXTENSIONS].join(",");
const IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif";

export const CHAT_FILE_ACCEPT = `${IMAGE_ACCEPT},${EXTRACT_ACCEPT_EXTENSIONS}`;
