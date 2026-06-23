import { beforeEach, describe, expect, it, vi } from "vitest";

import { insertAssetEvent } from "@/lib/ledger/events";
import type { LedgerScope } from "@/lib/ledger/scope";

vi.mock("@/lib/ledger/workspaces", () => ({
  getWorkspaceRow: vi.fn().mockResolvedValue({ id: "ws-1" }),
}));

describe("insertAssetEvent", () => {
  const insert = vi.fn();
  const select = vi.fn();

  const scope = {
    supabase: {
      from: vi.fn((table: string) => {
        if (table !== "ledger_asset_events") {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          select: (...args: unknown[]) => select(...args),
          insert,
        };
      }),
    },
    ledgerKey: "ledger-1",
    userId: null,
  } as unknown as LedgerScope;

  beforeEach(() => {
    insert.mockReset();
    select.mockReset();
  });

  it("retries with a fresh sequence after duplicate key errors", async () => {
    select.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { sequence: 4 }, error: null }),
          }),
        }),
      }),
    });

    insert
      .mockResolvedValueOnce({
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      })
      .mockResolvedValueOnce({ error: null });

    await insertAssetEvent(scope, {
      id: "evt-1",
      workspaceId: "ws-1",
      sequence: 4,
      type: "asset_updated",
      occurredAt: "2024-01-01T00:00:00.000Z",
      assetId: "asset-1",
      version: 2,
      title: "Spending table",
      payload: {
        id: "asset-1",
        kind: "table",
        title: "Spending table",
        columns: [],
        rows: [],
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });

    expect(insert).toHaveBeenCalledTimes(2);
  });
});
