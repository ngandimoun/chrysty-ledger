import { describe, expect, it } from "vitest";

import type { WorkspaceArtifact } from "@/lib/artifact-types";
import type { WorkspaceAsset } from "@/lib/asset-types";
import {
  buildRecentActivity,
  buildSuggestions,
  formatActivityLine,
  summarizeArtifact,
  summarizeAssetPayload,
  WORKSPACE_STARTER_SUGGESTIONS,
} from "@/lib/workspace-overview";

function makeAsset(
  overrides: Partial<WorkspaceAsset> & { payload: WorkspaceArtifact }
): WorkspaceAsset {
  return {
    id: "asset-1",
    workspaceId: "ws-1",
    title: "Test Asset",
    category: "sheet",
    kind: overrides.payload.kind,
    payload: overrides.payload,
    creationSequence: 1,
    version: 1,
    createdAt: "2024-06-01T10:00:00.000Z",
    updatedAt: "2024-06-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("summarizeAssetPayload", () => {
  it("summarizes table rows and columns", () => {
    const asset = makeAsset({
      payload: {
        id: "t-1",
        kind: "table",
        title: "Inventory",
        columns: ["Item", "Qty", "Price"],
        rows: [
          { Item: "Flour", Qty: "10", Price: "5" },
          { Item: "Sugar", Qty: "5", Price: "3" },
        ],
      },
    });
    expect(summarizeAssetPayload(asset)).toBe("2 rows · 3 columns");
  });

  it("summarizes file-list imports", () => {
    const asset = makeAsset({
      category: "export",
      payload: {
        id: "f-1",
        kind: "file-list",
        title: "Receipts",
        files: [
          { name: "r1.jpg", size: "1 MB" },
          { name: "r2.jpg", size: "2 MB" },
        ],
      },
    });
    expect(summarizeAssetPayload(asset)).toBe("2 files imported");
  });

  it("summarizes dashboard KPIs", () => {
    const asset = makeAsset({
      category: "dashboard",
      payload: {
        id: "d-1",
        kind: "dashboard",
        title: "Revenue Dashboard",
        kpis: [
          { label: "Revenue", value: "$10k" },
          { label: "Expenses", value: "$4k" },
        ],
        chart: { chartType: "bar", data: [{ label: "Jan", value: 100 }] },
      },
    });
    expect(summarizeAssetPayload(asset)).toBe("2 KPIs · with chart");
  });

  it("summarizes invoice client and total", () => {
    const asset = makeAsset({
      category: "invoice",
      payload: {
        id: "inv-1",
        kind: "invoice",
        title: "June Invoice",
        invoiceNumber: "001",
        clientName: "Acme Bakery",
        issueDate: "2024-06-01",
        dueDate: "2024-07-01",
        lineItems: [],
        total: "$1,200",
      },
    });
    expect(summarizeAssetPayload(asset)).toBe("Acme Bakery · $1,200");
  });
});

describe("formatActivityLine", () => {
  it("uses created for new assets", () => {
    const asset = makeAsset({
      title: "June Report",
      category: "report",
      payload: {
        id: "doc-1",
        kind: "document",
        title: "June Report",
        content: "Monthly summary",
      },
    });
    expect(formatActivityLine(asset)).toBe("June Report created");
  });

  it("uses updated when version is greater than 1", () => {
    const asset = makeAsset({
      title: "Inventory",
      version: 2,
      payload: {
        id: "t-1",
        kind: "table",
        title: "Inventory",
        columns: ["Item"],
        rows: [],
      },
    });
    expect(formatActivityLine(asset)).toBe("Inventory updated");
  });

  it("uses imported for file-list assets", () => {
    const asset = makeAsset({
      title: "Receipts",
      category: "export",
      payload: {
        id: "f-1",
        kind: "file-list",
        title: "Receipts",
        files: [{ name: "r1.jpg", size: "1 MB" }],
      },
    });
    expect(formatActivityLine(asset)).toBe("Receipts imported");
  });
});

describe("buildRecentActivity", () => {
  it("orders by updatedAt descending", () => {
    const older = makeAsset({
      id: "older",
      title: "Older Sheet",
      updatedAt: "2024-06-01T10:00:00.000Z",
      payload: {
        id: "t-old",
        kind: "table",
        title: "Older Sheet",
        columns: ["A"],
        rows: [],
      },
    });
    const newer = makeAsset({
      id: "newer",
      title: "Revenue Dashboard",
      category: "dashboard",
      createdAt: "2024-06-10T10:00:00.000Z",
      updatedAt: "2024-06-10T10:00:00.000Z",
      payload: {
        id: "d-1",
        kind: "dashboard",
        title: "Revenue Dashboard",
        kpis: [{ label: "Revenue", value: "$10k" }],
      },
    });

    const activity = buildRecentActivity([older, newer]);
    expect(activity[0]?.assetId).toBe("newer");
    expect(activity[0]?.line).toBe("Revenue Dashboard created");
    expect(activity[1]?.assetId).toBe("older");
  });
});

describe("buildSuggestions", () => {
  it("returns starter suggestions when empty", () => {
    expect(buildSuggestions([])).toEqual(WORKSPACE_STARTER_SUGGESTIONS);
  });

  it("suggests cashflow forecast when no dashboard exists", () => {
    const assets = [
      makeAsset({
        payload: {
          id: "t-1",
          kind: "table",
          title: "Transactions",
          columns: ["Date"],
          rows: [],
        },
      }),
    ];
    const labels = buildSuggestions(assets).map((chip) => chip.label);
    expect(labels).toContain("Create cashflow forecast");
    expect(labels).toContain("Analyze expenses");
  });

  it("suggests tax report when sheets exist without reports", () => {
    const assets = [
      makeAsset({
        payload: {
          id: "t-1",
          kind: "table",
          title: "Transactions",
          columns: ["Date"],
          rows: [],
        },
      }),
      makeAsset({
        id: "asset-2",
        category: "dashboard",
        creationSequence: 2,
        payload: {
          id: "d-1",
          kind: "dashboard",
          title: "Overview",
          kpis: [],
        },
      }),
    ];
    const labels = buildSuggestions(assets).map((chip) => chip.label);
    expect(labels).toContain("Generate tax report");
    expect(labels).not.toContain("Create cashflow forecast");
  });
});

describe("summarizeArtifact", () => {
  it("truncates long document content", () => {
    const summary = summarizeArtifact({
      id: "doc-1",
      kind: "document",
      title: "Report",
      content: "A".repeat(100),
    });
    expect(summary.length).toBeLessThanOrEqual(80);
    expect(summary.endsWith("...")).toBe(true);
  });
});
