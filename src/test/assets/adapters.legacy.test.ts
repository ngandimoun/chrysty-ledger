import { describe, expect, it } from "vitest";

import {
  artifactToAssetV2,
  assetV2ToArtifact,
  assetV2ToWorkspaceAsset,
  ledgerRowToWorkspaceAsset,
} from "@/lib/assets/adapters/legacy";
import type { WorkspaceArtifact } from "@/lib/artifact-types";

describe("legacy adapters", () => {
  it("converts table artifact to V2 and back", () => {
    const artifact: WorkspaceArtifact = {
      id: "t-1",
      kind: "table",
      title: "Transactions",
      columns: ["Date", "Amount"],
      rows: [{ Date: "2024-01-01", Amount: "10" }],
    };
    const asset = artifactToAssetV2(artifact, "ws-1");
    expect(asset.kind).toBe("table");
    expect(asset.schema.columns).toHaveLength(2);

    const roundTrip = assetV2ToArtifact(asset);
    expect(roundTrip.kind).toBe("table");
    if (roundTrip.kind === "table") {
      expect(roundTrip.columns).toEqual(["Date", "Amount"]);
    }
  });

  it("converts invoice artifact to document subtype invoice", () => {
    const artifact: WorkspaceArtifact = {
      id: "inv-1",
      kind: "invoice",
      title: "Invoice #1",
      invoiceNumber: "001",
      clientName: "Acme",
      issueDate: "2024-01-01",
      dueDate: "2024-02-01",
      lineItems: [{ description: "Work", quantity: 1, rate: "100", amount: "100" }],
      total: "100",
    };
    const asset = artifactToAssetV2(artifact, "ws-1");
    expect(asset.kind).toBe("document");
    expect(asset.subtype).toBe("invoice");

    const workspaceAsset = assetV2ToWorkspaceAsset(asset);
    expect(workspaceAsset.payload.kind).toBe("invoice");
  });

  it("converts table artifact with object columns in legacy payload", () => {
    const artifact = {
      id: "t-hybrid",
      kind: "table" as const,
      title: "Rohit Sharma spending (debug)",
      columns: [
        { key: "category", label: "Category", type: "text" },
        { key: "amount", label: "Amount", type: "currency" },
      ],
      rows: [
        { category: "Room rent", amount: 1800 },
        { category: "Food", amount: 560 },
      ],
    };
    const asset = artifactToAssetV2(artifact as WorkspaceArtifact, "ws-1");
    expect(asset.schema.columns).toEqual([
      { key: "category", label: "Category", type: "text" },
      { key: "amount", label: "Amount", type: "currency" },
    ]);
    expect(asset.data.rows).toEqual([
      { category: "Room rent", amount: 1800 },
      { category: "Food", amount: 560 },
    ]);
  });

  it("hydrates workspace asset from V2-only ledger row", () => {
    const asset = artifactToAssetV2(
      {
        id: "t-2",
        kind: "table",
        title: "Transactions",
        columns: ["Date", "Amount"],
        rows: [{ Date: "2024-01-01", Amount: "10" }],
      },
      "ws-1"
    );

    const workspaceAsset = ledgerRowToWorkspaceAsset({
      id: asset.id,
      workspace_id: "ws-1",
      project_id: null,
      title: asset.title,
      category: "sheet",
      kind: "table",
      subtype: "sheet",
      payload: {},
      asset_schema: asset.schema as never,
      asset_data: asset.data as never,
      relations: [],
      metadata: {},
      source_message_id: null,
      creation_sequence: 1,
      version: 1,
      created_at: asset.createdAt,
      updated_at: asset.updatedAt,
      archived_at: null,
    });

    expect(workspaceAsset.payload.kind).toBe("table");
    if (workspaceAsset.payload.kind === "table") {
      expect(workspaceAsset.payload.columns).toEqual(["Date", "Amount"]);
    }
  });

  it("converts single upload file asset to non-empty file-list artifact", () => {
    const artifact = assetV2ToArtifact({
      id: "file-1",
      workspaceId: "ws-1",
      kind: "file",
      subtype: "upload",
      title: "receipt.png",
      schema: { filename: "receipt.png", mimeType: "image/png" },
      data: {
        storageRef: "supabase://ledger-uploads/ledger-1/ws-1/file-1/receipt.png",
        size: 2048,
      },
      relations: [],
      metadata: {},
      version: 1,
      creationSequence: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    expect(artifact.kind).toBe("file-list");
    if (artifact.kind === "file-list") {
      expect(artifact.files).toEqual([{ name: "receipt.png", size: "2.0 KB" }]);
    }
  });

  it("hydrates upload file ledger rows as file-list workspace assets", () => {
    const workspaceAsset = ledgerRowToWorkspaceAsset({
      id: "file-ledger-1",
      workspace_id: "ws-1",
      project_id: null,
      title: "receipt.png",
      category: "file",
      kind: "file",
      subtype: "upload",
      payload: {
        id: "file-ledger-1",
        kind: "file-list",
        title: "receipt.png",
        files: [{ name: "receipt.png", size: "2.0 KB" }],
      } as never,
      asset_schema: { filename: "receipt.png", mimeType: "image/png" } as never,
      asset_data: {
        storageRef: "supabase://ledger-uploads/ledger-1/ws-1/file-ledger-1/receipt.png",
        size: 2048,
      } as never,
      relations: [],
      metadata: {},
      source_message_id: "msg-1",
      creation_sequence: 4,
      version: 1,
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      archived_at: null,
    });

    expect(workspaceAsset.kind).toBe("file-list");
    expect(workspaceAsset.category).toBe("files");
    if (workspaceAsset.payload.kind === "file-list") {
      expect(workspaceAsset.payload.files[0]?.name).toBe("receipt.png");
    }
  });
});
