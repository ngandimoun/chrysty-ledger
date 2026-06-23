import { describe, expect, it } from "vitest";

import {
  buildAssetTitleDisambiguation,
  formatAssetRecencyDate,
  formatRelativeDate,
  truncateFilename,
} from "@/components/workspace/assets-explorer/asset-utils";
import type { WorkspaceAsset } from "@/lib/asset-types";

function makeAsset(overrides: Partial<WorkspaceAsset>): WorkspaceAsset {
  return {
    id: "asset-1",
    workspaceId: "ws-1",
    title: "Payment status",
    category: "sheet",
    kind: "table",
    payload: {
      id: "asset-1",
      kind: "table",
      title: "Payment status",
      columns: [],
      rows: [],
    },
    creationSequence: 1,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("formatRelativeDate", () => {
  it("includes time for same-day assets", () => {
    const label = formatRelativeDate(new Date().toISOString());
    expect(label).toMatch(/^Today \d/);
  });
});

describe("formatAssetRecencyDate", () => {
  it("uses updatedAt when version is greater than one", () => {
    const label = formatAssetRecencyDate(
      makeAsset({
        version: 3,
        createdAt: "2024-01-01T10:00:00.000Z",
        updatedAt: new Date().toISOString(),
      })
    );

    expect(label).toMatch(/^Today /);
  });
});

describe("buildAssetTitleDisambiguation", () => {
  it("adds timestamps for duplicate titles in a group", () => {
    const labels = buildAssetTitleDisambiguation([
      makeAsset({
        id: "a-1",
        title: "Payment status",
        createdAt: "2024-06-23T15:00:00.000Z",
        updatedAt: "2024-06-23T15:00:00.000Z",
      }),
      makeAsset({
        id: "a-2",
        title: "Payment status",
        createdAt: "2024-06-23T16:00:00.000Z",
        updatedAt: "2024-06-23T16:00:00.000Z",
      }),
    ]);

    expect(labels.get("a-1")).toBeTruthy();
    expect(labels.get("a-2")).toBeTruthy();
  });
});

describe("truncateFilename", () => {
  it("shortens long upload filenames for the sidebar", () => {
    expect(
      truncateFilename("ChatGPT Image Jun 23, 2026, 03_05_16 PM.png", 28)
    ).toContain("…");
    expect(truncateFilename("ChatGPT Image Jun 23, 2026, 03_05_16 PM.png", 28)).toContain(".png");
  });
});
