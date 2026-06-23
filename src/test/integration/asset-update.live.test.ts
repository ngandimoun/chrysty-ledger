import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { maybeCreateAssetsFromTurn } from "@/lib/ai/orchestrator/turn-asset-pipeline";
import { getAssetV2 } from "@/lib/assets/service";
import { createLedgerScope } from "@/lib/ledger/scope";

const LIVE =
  process.env.RUN_LIVE_TESTS === "1" &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);

const WORKSPACE_ID = "294a8c57-6e10-4437-9e96-58f84353d2ad";
const LEDGER_KEY = "ledger_c6d501d0-b709-47a8-8552-02228069b7b0";
const TARGET_TABLE_ID = "f4d8fa38-9a60-4f5b-837a-3aaa28117a0f";

const ANALYSIS_WITH_NEW_ROW = `Spending Breakdown by Category
Category	Amount	% of Total
Room Rent	₹1,800	64.7%
Food & Beverages	₹550	19.8%
Transport	₹350	12.6%
Services	₹50	1.8%
Beverages	₹30	1.1%
Entertainment	₹200	7.2%`;

describe.skipIf(!LIVE)("live asset update against Supabase", () => {
  let scope: ReturnType<typeof createLedgerScope>;
  let baselineVersion = 0;
  let baselineRowCount = 0;

  beforeAll(async () => {
    scope = createLedgerScope({ ledgerKey: LEDGER_KEY, userId: null });
    const existing = await getAssetV2(scope, WORKSPACE_ID, TARGET_TABLE_ID);
    if (!existing) {
      throw new Error("Target asset not found");
    }
    baselineVersion = existing.version;
    baselineRowCount = Array.isArray(existing.data.rows) ? existing.data.rows.length : 0;
  });

  afterAll(async () => {
    if (!scope) return;
    const existing = await getAssetV2(scope, WORKSPACE_ID, TARGET_TABLE_ID);
    if (!existing) return;

    const rows = Array.isArray(existing.data.rows)
      ? (existing.data.rows as Array<Record<string, unknown>>)
      : [];
    const filtered = rows.filter((row) => String(row.category ?? row.Category ?? "") !== "Entertainment");
    if (filtered.length === rows.length) return;

    const { updateAssetV2 } = await import("@/lib/assets/service");
    await updateAssetV2(scope, WORKSPACE_ID, TARGET_TABLE_ID, {
      data: { rows: filtered },
    });
  });

  it("updates the open table asset and merges a new category row", async () => {
    const result = await maybeCreateAssetsFromTurn({
      workspaceId: WORKSPACE_ID,
      scope,
      userInput: "add this new Entertainment expense to the category spending table",
      chatText: ANALYSIS_WITH_NEW_ROW,
      attachments: [],
      visionInputs: [],
      fileSystemMessages: [],
      appHistory: [],
      targetAssetId: TARGET_TABLE_ID,
    });

    expect(result.skipped).toBe(false);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.id).toBe(TARGET_TABLE_ID);
    expect(result.assets[0]?.version).toBeGreaterThan(baselineVersion);

    const rows = Array.isArray(result.assets[0]?.data.rows)
      ? (result.assets[0]?.data.rows as Array<Record<string, unknown>>)
      : [];
    expect(rows.length).toBeGreaterThanOrEqual(baselineRowCount);
    expect(
      rows.some((row) => String(row.category ?? row.Category ?? "").includes("Entertainment"))
    ).toBe(true);
  });
});
