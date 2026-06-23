import { describe, expect, it } from "vitest";

import { ledgerRowToWorkspaceAsset } from "@/lib/assets/adapters/legacy";
import { assetFromRow } from "@/lib/ledger/mappers";
import type { Tables } from "@/lib/supabase/database.types";

const baseRow: Tables<"ledger_assets"> = {
  id: "chart-1",
  workspace_id: "ws-1",
  project_id: null,
  title: "Spending by category",
  category: "chart",
  kind: "chart",
  subtype: "spending",
  payload: {},
  asset_schema: {
    intent: "compare_categories",
    title: "Spending by category",
  },
  asset_data: {
    series: [
      { label: "Room Rent", value: 1800 },
      { label: "Food", value: 550 },
    ],
  },
  relations: [],
  metadata: {},
  source_message_id: null,
  creation_sequence: 1,
  version: 1,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  archived_at: null,
};

describe("ledgerRowToWorkspaceAsset", () => {
  it("hydrates chart payload from V2 columns when legacy payload is empty", () => {
    const workspaceAsset = ledgerRowToWorkspaceAsset(baseRow);

    expect(workspaceAsset.payload.kind).toBe("chart");
    if (workspaceAsset.payload.kind === "chart") {
      expect(workspaceAsset.payload.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ label: "Room Rent", value: 1800 })])
      );
    }
  });

  it("assetFromRow delegates to hydration helper", () => {
    const workspaceAsset = assetFromRow(baseRow);
    expect(workspaceAsset.id).toBe("chart-1");
    expect(workspaceAsset.payload.kind).toBe("chart");
  });

  it("keeps legacy payload when already populated", () => {
    const row: Tables<"ledger_assets"> = {
      ...baseRow,
      payload: {
        id: "chart-1",
        kind: "chart",
        title: "Legacy chart",
        chartType: "pie",
        data: [{ label: "A", value: 1 }],
      },
    };

    const workspaceAsset = ledgerRowToWorkspaceAsset(row);
    expect(workspaceAsset.payload.kind).toBe("chart");
    if (workspaceAsset.payload.kind === "chart") {
      expect(workspaceAsset.title).toBe("Spending by category");
      expect(workspaceAsset.payload.chartType).toBe("pie");
    }
  });
});
