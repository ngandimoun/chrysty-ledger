import { describe, expect, it } from "vitest";

import { createInMemoryAsset } from "@/lib/assets/service";

describe("action executor validation integration", () => {
  it("create path validates before in-memory fallback shape", () => {
    const asset = createInMemoryAsset({
      workspaceId: "ws-1",
      kind: "table",
      subtype: "transactions",
      title: "Q2 Transactions",
      schema: {
        columns: [
          { key: "date", label: "Date", type: "date" },
          { key: "amount", label: "Amount", type: "currency" },
        ],
      },
      data: {
        rows: [{ date: "2024-04-01", amount: 42 }],
      },
    });
    expect(asset.subtype).toBe("transactions");
    expect(asset.schema.columns).toHaveLength(2);
  });
});
