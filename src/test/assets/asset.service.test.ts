import { describe, expect, it, vi, beforeEach } from "vitest";

import { createInMemoryAsset, createAssetV2 } from "@/lib/assets/service";
import type { LedgerScope } from "@/lib/ledger/scope";

vi.mock("@/lib/ledger/workspaces", () => ({
  getWorkspaceRow: vi.fn(),
}));

import { getWorkspaceRow } from "@/lib/ledger/workspaces";

const mockScope = {
  supabase: {},
  ledgerKey: "ledger-1",
  userId: "user-1",
} as LedgerScope;

describe("AssetService in-memory", () => {
  it("creates validated asset without DB", () => {
    const asset = createInMemoryAsset({
      workspaceId: "ws-1",
      kind: "document",
      title: "Note",
      schema: { sections: [{ title: "Body", type: "text" }] },
      data: { sections: [{ title: "Body", body: "Hello" }] },
    });
    expect(asset.id).toBeTruthy();
    expect(asset.kind).toBe("document");
  });

  it("throws on invalid table", () => {
    expect(() =>
      createInMemoryAsset({
        workspaceId: "ws-1",
        kind: "table",
        title: "Bad",
        schema: { columns: [] },
        data: { rows: [] },
      })
    ).toThrow();
  });
});

describe("createAssetV2", () => {
  beforeEach(() => {
    vi.mocked(getWorkspaceRow).mockReset();
  });

  it("returns NOT_FOUND error instead of throwing when workspace is missing", async () => {
    vi.mocked(getWorkspaceRow).mockResolvedValue(null);

    const scope = {
      ...mockScope,
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      },
    } as unknown as LedgerScope;

    const result = await createAssetV2(scope, {
      workspaceId: "missing-ws",
      kind: "document",
      title: "Note",
      schema: { sections: [{ title: "Body", type: "text" }] },
      data: { sections: [{ title: "Body", body: "Hello" }] },
    });

    expect(result).toEqual({
      error: { code: "NOT_FOUND", message: "Workspace not found" },
    });
  });

  it("persists legacy payload alongside V2 schema/data", async () => {
    vi.mocked(getWorkspaceRow).mockResolvedValue({
      id: "ws-1",
      name: "Test",
      ledger_key: "ledger-1",
      user_id: "user-1",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      canvas_state: {},
      settings: {},
      platform_workspace_id: null,
    });

    const upsert = vi.fn().mockResolvedValue({ error: null });
    const scope = {
      ...mockScope,
      supabase: {
        from: () => ({
          upsert,
        }),
      },
    } as unknown as LedgerScope;

    const result = await createAssetV2(scope, {
      workspaceId: "ws-1",
      kind: "chart",
      title: "Spending by category",
      schema: { intent: "compare_categories", title: "Spending by category" },
      data: {
        series: [{ label: "Room Rent", value: 1800 }],
      },
    });

    expect(result).toHaveProperty("asset");
    expect(upsert).toHaveBeenCalledTimes(1);
    const row = upsert.mock.calls[0]?.[0];
    expect(row.payload).toEqual(
      expect.objectContaining({
        kind: "chart",
        title: "Spending by category",
      })
    );
    expect(row.asset_schema).toEqual(
      expect.objectContaining({ intent: "compare_categories" })
    );
    expect(row.asset_data).toEqual(
      expect.objectContaining({
        series: [{ label: "Room Rent", value: 1800 }],
      })
    );
  });
});
