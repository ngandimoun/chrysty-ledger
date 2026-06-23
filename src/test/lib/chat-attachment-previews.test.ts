import { describe, expect, it, vi, afterEach } from "vitest";

import {
  getFilePreviewKey,
  revokeFilePreviewUrls,
} from "@/lib/chat-attachment-previews";

describe("chat attachment previews", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a stable preview key from file metadata", () => {
    const file = new File(["hello"], "photo.jpg", {
      type: "image/jpeg",
      lastModified: 1_700_000_000_000,
    });

    expect(getFilePreviewKey(file)).toBe("photo.jpg-5-1700000000000");
  });

  it("revokes blob preview URLs only", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    revokeFilePreviewUrls({
      a: "blob:http://localhost/abc",
      b: "https://example.com/image.jpg",
    });

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:http://localhost/abc");
  });
});
