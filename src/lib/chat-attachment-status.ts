import { isImageMime } from "@/lib/ai/vision";

type AttachmentLike = {
  type: string;
};

export function formatAttachmentProcessingStatus(files: AttachmentLike[]): string {
  if (files.length === 0) {
    return "Understanding your request…";
  }

  if (files.length === 1) {
    return isImageMime(files[0]!.type || "")
      ? "Analyzing your image…"
      : "Reading your file…";
  }

  const imageCount = files.filter((file) => isImageMime(file.type || "")).length;
  if (imageCount === files.length) {
    return `Analyzing ${files.length} images…`;
  }

  return `Analyzing ${files.length} files…`;
}
