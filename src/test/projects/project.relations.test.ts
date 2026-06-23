import { describe, expect, it } from "vitest";

import { createInMemoryAsset } from "@/lib/assets/service";

describe("project relations", () => {
  it("stores embedded relations on asset", () => {
    const source = createInMemoryAsset({
      workspaceId: "ws-1",
      kind: "file",
      title: "receipt.pdf",
      schema: { filename: "receipt.pdf" },
      data: { storageRef: "upload://1" },
    });

    const derived = createInMemoryAsset({
      workspaceId: "ws-1",
      kind: "table",
      title: "Transactions",
      schema: {
        columns: [{ key: "amount", label: "Amount", type: "currency" }],
      },
      data: { rows: [{ amount: 10 }] },
      relations: [{ targetAssetId: source.id, relation: "derived_from" }],
    });

    expect(derived.relations[0]?.targetAssetId).toBe(source.id);
    expect(derived.relations[0]?.relation).toBe("derived_from");
  });
});
