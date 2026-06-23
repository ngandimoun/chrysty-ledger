import { describe, expect, it } from "vitest";

import {
  buildStorageRef,
  parseStorageRef,
} from "@/lib/storage/storage-ref";

describe("workspace-files storage refs", () => {
  it("round-trips supabase storage refs", () => {
    const ref = buildStorageRef("ledger-uploads", "ledger-1/ws-1/asset-1/receipt.png");
    expect(ref).toBe("supabase://ledger-uploads/ledger-1/ws-1/asset-1/receipt.png");
    expect(parseStorageRef(ref)).toEqual({
      bucket: "ledger-uploads",
      path: "ledger-1/ws-1/asset-1/receipt.png",
    });
  });

  it("returns null for unsupported refs", () => {
    expect(parseStorageRef("moonshot://file-123")).toBeNull();
  });
});
