import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import type { Asset } from "@/lib/assets/asset";
import {
  pickReferencedStructuredTargetAssetId,
  resolveReferencedAssets,
} from "@/lib/ai/resolve-referenced-assets";
import { getAssetV2 } from "@/lib/assets/service";
import { downloadWorkspaceFile } from "@/lib/storage/workspace-files";
import type { LedgerScope } from "@/lib/ledger/scope";

vi.mock("@/lib/assets/service", () => ({
  getAssetV2: vi.fn(),
}));

vi.mock("@/lib/storage/workspace-files", () => ({
  downloadWorkspaceFile: vi.fn(),
}));

const scope = { ledgerKey: "ledger-1" } as LedgerScope;

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-1",
    workspaceId: "ws-1",
    projectId: null,
    kind: "table",
    subtype: null,
    title: "Spending table",
    schema: { columns: [{ key: "vendor", label: "Vendor", type: "text" }] },
    data: { rows: [{ vendor: "Acme" }] },
    relations: [],
    metadata: {},
    version: 1,
    creationSequence: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

describe("resolveReferencedAssets", () => {
  beforeEach(() => {
    vi.mocked(getAssetV2).mockReset();
    vi.mocked(downloadWorkspaceFile).mockReset();
  });

  it("builds structured system messages for table assets", async () => {
    vi.mocked(getAssetV2).mockResolvedValue(makeAsset());

    const result = await resolveReferencedAssets({
      scope,
      workspaceId: "ws-1",
      assetIds: ["asset-1"],
    });

    expect(result.attachments).toHaveLength(0);
    expect(result.systemMessages).toHaveLength(1);
    expect(result.systemMessages[0]).toContain("Spending table");
    expect(result.resolved[0]).toMatchObject({
      id: "asset-1",
      title: "Spending table",
      kind: "table",
    });
  });

  it("downloads file assets into attachments", async () => {
    vi.mocked(getAssetV2).mockResolvedValue(
      makeAsset({
        id: "file-1",
        kind: "file",
        subtype: "upload",
        title: "receipt.png",
        schema: { filename: "receipt.png", mimeType: "image/png" },
        data: {
          storageRef: "supabase://ledger-uploads/ledger-1/ws-1/file-1/receipt.png",
        },
      })
    );
    vi.mocked(downloadWorkspaceFile).mockResolvedValue(Buffer.from("image-bytes"));

    const result = await resolveReferencedAssets({
      scope,
      workspaceId: "ws-1",
      assetIds: ["file-1"],
    });

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({
      filename: "receipt.png",
      mimeType: "image/png",
      sourceAssetId: "file-1",
    });
    expect(result.systemMessages).toHaveLength(0);
  });

  it("skips missing assets gracefully", async () => {
    vi.mocked(getAssetV2).mockResolvedValue(null);

    const result = await resolveReferencedAssets({
      scope,
      workspaceId: "ws-1",
      assetIds: ["missing"],
    });

    expect(result.resolved).toHaveLength(0);
    expect(result.attachments).toHaveLength(0);
    expect(result.systemMessages).toHaveLength(0);
  });
});

describe("pickReferencedStructuredTargetAssetId", () => {
  it("returns the only structured asset id", () => {
    expect(
      pickReferencedStructuredTargetAssetId([
        { id: "chart-1", title: "Chart", kind: "chart", category: "chart" },
      ])
    ).toBe("chart-1");
  });

  it("returns undefined when multiple structured assets are referenced", () => {
    expect(
      pickReferencedStructuredTargetAssetId([
        { id: "chart-1", title: "Chart", kind: "chart", category: "chart" },
        { id: "table-1", title: "Table", kind: "table", category: "sheet" },
      ])
    ).toBeUndefined();
  });
});
