import { describe, expect, it } from "vitest";

import {
  extractPromptTopic,
  resolveChatTargetAssetId,
  resolveTurnIntent,
  userRequestsAssetRevision,
} from "@/lib/ai/orchestrator/turn-intent";

describe("resolveTurnIntent", () => {
  it("returns create_assets for image + cash flow viz without revision verbs", () => {
    expect(
      resolveTurnIntent({
        userInput: "do Cash Flow Management and some viz",
        attachmentCount: 1,
      })
    ).toBe("create_assets");
  });

  it("returns update_asset when user names a table and asks to add a row", () => {
    expect(
      resolveTurnIntent({
        userInput: "add a row to Data table 1",
        attachmentCount: 1,
        openAssetId: "asset-open",
      })
    ).toBe("update_asset");
  });

  it("returns text_only when user asks for explanation only", () => {
    expect(
      resolveTurnIntent({
        userInput: "just explain this image",
        attachmentCount: 1,
      })
    ).toBe("text_only");
  });

  it("does not treat upload alone as update_asset", () => {
    expect(
      resolveTurnIntent({
        userInput: "help with this receipt",
        attachmentCount: 1,
        openAssetId: "asset-open",
      })
    ).not.toBe("update_asset");
  });
});

describe("resolveChatTargetAssetId", () => {
  it("returns open asset only for update_asset intent", () => {
    expect(
      resolveChatTargetAssetId({
        userInput: "do Cash Flow Management and some viz",
        attachmentCount: 1,
        openAssetId: "asset-open",
      })
    ).toBeUndefined();

    expect(
      resolveChatTargetAssetId({
        userInput: "add this receipt to the spending table",
        attachmentCount: 1,
        openAssetId: "asset-open",
      })
    ).toBe("asset-open");
  });

  it("falls back to a single referenced asset when canvas is closed", () => {
    expect(
      resolveChatTargetAssetId({
        userInput: "update this table",
        attachmentCount: 1,
        openAssetId: null,
        referencedAssetIds: ["asset-table-1"],
      })
    ).toBe("asset-table-1");
  });
});

describe("extractPromptTopic", () => {
  it("detects cash flow topics", () => {
    expect(extractPromptTopic("do Cash Flow Management and some viz")).toBe("Cash flow");
    expect(extractPromptTopic("show liquidity trends")).toBe("Liquidity");
  });
});

describe("userRequestsAssetRevision", () => {
  it("detects add-to-table phrasing", () => {
    expect(userRequestsAssetRevision("add this receipt to the spending table")).toBe(true);
    expect(userRequestsAssetRevision("do Cash Flow Management and some viz")).toBe(false);
  });
});
