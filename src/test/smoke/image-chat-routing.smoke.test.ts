import { describe, expect, it } from "vitest";

import {
  hasMixedFileAndVision,
  hasOnlyVisionAttachments,
  hasVisionAttachments,
  shouldRouteToChat,
} from "@/lib/ai/orchestrator/action-routing";
import {
  shouldAttemptAssetFromTurn,
  shouldUpdateExistingAsset,
  userWantsTextOnly,
  userWantsVisualization,
} from "@/lib/ai/orchestrator/vision-intent";
import { resolveTurnIntent } from "@/lib/ai/orchestrator/turn-intent";

describe("vision attachment routing", () => {
  it("detects image-only attachments", () => {
    expect(hasOnlyVisionAttachments(["image/png"])).toBe(true);
    expect(hasOnlyVisionAttachments(["image/png", "image/jpeg"])).toBe(true);
    expect(hasOnlyVisionAttachments(["application/pdf"])).toBe(false);
    expect(hasOnlyVisionAttachments(["text/csv", "image/png"])).toBe(false);
  });

  it("detects mixed file and vision attachments", () => {
    expect(hasMixedFileAndVision(["text/csv", "image/png"])).toBe(true);
    expect(hasMixedFileAndVision(["image/png"])).toBe(false);
    expect(hasVisionAttachments(["image/webp"])).toBe(true);
  });
});

describe("vision intent", () => {
  it("attempts assets for attachments unless text-only requested", () => {
    expect(
      shouldAttemptAssetFromTurn({
        userInput: "help with this",
        chatText: "Here is a spending breakdown",
        attachmentCount: 1,
      })
    ).toBe(true);

    expect(
      shouldAttemptAssetFromTurn({
        userInput: "just explain this image",
        chatText: "A chart of revenue",
        attachmentCount: 1,
      })
    ).toBe(false);
  });

  it("detects revision intent against recent asset", () => {
    expect(
      shouldUpdateExistingAsset({
        userInput: "update Data table 1 with the new totals",
        targetAssetId: "asset-1",
      })
    ).toBe(true);

    expect(
      shouldUpdateExistingAsset({
        userInput: "add these new expenses to the spending table",
        targetAssetId: "asset-1",
      })
    ).toBe(true);

    expect(
      shouldUpdateExistingAsset({
        userInput: "add this receipt to the spending table",
        targetAssetId: "asset-open",
        attachmentCount: 1,
      })
    ).toBe(true);

    expect(
      shouldUpdateExistingAsset({
        userInput: "do Cash Flow Management and some viz",
        targetAssetId: "asset-open",
        attachmentCount: 1,
      })
    ).toBe(false);

    expect(
      shouldUpdateExistingAsset({
        userInput: "create a brand new dashboard",
        recentAssetId: "asset-1",
      })
    ).toBe(false);
  });

  it("respects explicit text-only prompts", () => {
    expect(userWantsTextOnly("don't save a chart, just explain")).toBe(true);
  });

  it("detects explicit visualization requests", () => {
    expect(userWantsVisualization("do the viz of my clients")).toBe(true);
    expect(userWantsVisualization("create a dashboard")).toBe(true);
  });

  it("routes fresh image + cash flow viz to create_assets not bulk update", () => {
    expect(
      resolveTurnIntent({
        userInput: "do Cash Flow Management and some viz",
        attachmentCount: 1,
        openAssetId: "open-chart",
      })
    ).toBe("create_assets");

    expect(
      shouldUpdateExistingAsset({
        userInput: "do Cash Flow Management and some viz",
        targetAssetId: "open-chart",
        attachmentCount: 1,
      })
    ).toBe(false);
  });
});

describe("shouldRouteToChat attachment matrix", () => {
  const importPlan = [{ action: "import", inputs: { useAttachments: true } }];

  it("keeps file-only import on executor path", () => {
    expect(
      shouldRouteToChat({
        actions: importPlan,
        attachmentCount: 1,
        attachmentTypes: ["application/pdf"],
        assetCount: 0,
        mode: "default",
      })
    ).toBe(false);
  });

  it("routes multi-image to chat", () => {
    expect(
      shouldRouteToChat({
        actions: importPlan,
        attachmentCount: 3,
        attachmentTypes: ["image/png", "image/jpeg", "image/webp"],
        assetCount: 0,
        mode: "default",
      })
    ).toBe(true);
  });
});
