import { describe, expect, it } from "vitest";

import { formatAttachmentProcessingStatus } from "@/lib/chat-attachment-status";

describe("formatAttachmentProcessingStatus", () => {
  it("labels a single image", () => {
    expect(formatAttachmentProcessingStatus([{ type: "image/png" }])).toBe(
      "Analyzing your image…"
    );
  });

  it("labels multiple images", () => {
    expect(
      formatAttachmentProcessingStatus([
        { type: "image/png" },
        { type: "image/jpeg" },
        { type: "image/webp" },
      ])
    ).toBe("Analyzing 3 images…");
  });

  it("labels mixed file types as files", () => {
    expect(
      formatAttachmentProcessingStatus([
        { type: "text/csv" },
        { type: "image/png" },
      ])
    ).toBe("Analyzing 2 files…");
  });

  it("labels a single non-image file", () => {
    expect(formatAttachmentProcessingStatus([{ type: "application/pdf" }])).toBe(
      "Reading your file…"
    );
  });
});
