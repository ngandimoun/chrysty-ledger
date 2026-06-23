import { describe, expect, it } from "vitest";

import {
  containsAsciiVizArtifacts,
  extractAssetsFromChatAnalysis,
  hasParseableNumericTables,
  isSummaryRowLabel,
  parseAmount,
  parseTablesFromChat,
  resolveAnalysisTextForAssets,
  sanitizeTableCellValue,
} from "@/lib/ai/orchestrator/chat-analysis-assets";

const ROHIT_ANALYSIS = `Here's the complete spending analysis for your guest Rohit Sharma (Room 205):

Spending Breakdown by Category
Category	Amount	% of Total
Room Rent	₹1,800	64.7%
Food & Beverages	₹550	19.8%
Transport	₹350	12.6%
Services (WiFi)	₹50	1.8%
Beverages (Water)	₹30	1.1%
Total	₹2,780	100%

Daily Spending Pattern
Date	Amount	Notes
18/05	₹1,500	Check-in day + meals + WiFi setup
19/05	₹250	Light day (breakfast, tea, dinner)
20/05	₹1,030	Extra night + airport taxi

Payment Status
Item	Amount
Total Bill	₹2,780
Paid (20/05/2024)	₹2,000
Remaining Balance	₹780`;

describe("parseAmount", () => {
  it("parses currency values", () => {
    expect(parseAmount("₹1,800")).toBe(1800);
    expect(parseAmount("₹2,780")).toBe(2780);
    expect(parseAmount("**₹2,780**")).toBe(2780);
  });
});

describe("isSummaryRowLabel", () => {
  it("detects payment summary labels", () => {
    expect(isSummaryRowLabel("Grand Total")).toBe(true);
    expect(isSummaryRowLabel("Paid (20/05/2024)")).toBe(true);
    expect(isSummaryRowLabel("Balance Due")).toBe(true);
    expect(isSummaryRowLabel("Room Rent")).toBe(false);
  });
});

describe("sanitizeTableCellValue", () => {
  it("strips markdown emphasis from table cells", () => {
    expect(sanitizeTableCellValue("**Grand Total**")).toBe("Grand Total");
    expect(sanitizeTableCellValue("**2,780**")).toBe("2,780");
  });
});

describe("parseTablesFromChat", () => {
  it("parses tab-separated spending tables", () => {
    const tables = parseTablesFromChat(ROHIT_ANALYSIS);
    expect(tables.length).toBeGreaterThanOrEqual(3);
    expect(tables[0]?.headers).toContain("Category");
    expect(tables[0]?.rows[0]?.[0]).toBe("Room Rent");
  });
});

describe("hasParseableNumericTables", () => {
  it("detects numeric spending tables in analysis text", () => {
    expect(hasParseableNumericTables(ROHIT_ANALYSIS)).toBe(true);
    expect(hasParseableNumericTables("No numbers here.")).toBe(false);
  });
});

describe("extractAssetsFromChatAnalysis", () => {
  it("builds sheet tables and chart series for Rohit Sharma analysis", () => {
    const assets = extractAssetsFromChatAnalysis({
      chatText: ROHIT_ANALYSIS,
      userInput: "do the viz of my clients and tell me how it spend",
      workspaceId: "ws-1",
    });

    expect(assets.length).toBeGreaterThan(0);

    const tables = assets.filter((asset) => asset.kind === "table");
    expect(tables.length).toBeGreaterThanOrEqual(2);

    const chart = assets.find(
      (asset) =>
        asset.kind === "chart" &&
        asset.schema.intent === "compare_categories"
    );
    expect(chart).toBeDefined();

    const series = (chart?.data.series ?? []) as Array<{ label: string; value: number }>;
    expect(series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Room Rent", value: 1800 }),
        expect.objectContaining({ label: "Food & Beverages", value: 550 }),
      ])
    );
    expect(chart?.title).toContain("Rohit Sharma");
  });

  it("splits summary rows into a separate payment status sheet", () => {
    const assets = extractAssetsFromChatAnalysis({
      chatText: `Category	Total (₹)
Room Rent	1800
Food & Beverages	550
Grand Total	2780
Paid	2000
Balance Due	780`,
      userInput: "viz this expense",
      workspaceId: "ws-1",
    });

    const tables = assets.filter((asset) => asset.kind === "table");
    const categorySheet = tables.find((asset) => !asset.title.includes("Payment status"));
    const paymentSheets = tables.filter((asset) => asset.title.includes("Payment status"));

    expect(categorySheet?.data.rows).toHaveLength(2);
    expect(paymentSheets).toHaveLength(1);
    expect(paymentSheets[0]?.data.rows).toHaveLength(3);
    expect(paymentSheets[0]?.title).toBe("Expenses — Payment status");
    expect(
      (categorySheet?.data.rows as Array<Record<string, unknown>>).some((row) =>
        String(row.category ?? "").includes("Grand Total")
      )
    ).toBe(false);
  });

  it("builds a daily spending chart when category table is absent", () => {
    const assets = extractAssetsFromChatAnalysis({
      chatText: `Daily Spending Pattern
Date	Amount	Notes
18/05	₹1,500	Check-in
19/05	₹250	Light day`,
      userInput: "viz daily spending",
      workspaceId: "ws-1",
    });

    const chart = assets.find((asset) => asset.kind === "chart");
    expect(chart?.schema).toEqual(
      expect.objectContaining({ intent: "show_over_time" })
    );
    expect(chart?.data.series).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "18/05", value: 1500 })])
    );
  });

  it("prefixes titles with attachment filename when topic is absent", () => {
    const assets = extractAssetsFromChatAnalysis({
      chatText: `Item	Amount
Total Bill	2780
Paid	2000
Balance Due	780`,
      userInput: "summarize this upload",
      workspaceId: "ws-1",
      attachmentFilename: "hotel-receipt-may.png",
    });

    const paymentSheet = assets.find((asset) => asset.title.includes("Payment status"));
    expect(paymentSheet?.title).toContain("hotel-receipt-may");
  });
});

const ASCII_VIZ_REPLY = `Visual Breakdown
Category	Amount	Visual
Room Rent	₹1,800	████████████████ 64.7%
Food & Beverages	₹550	████████ 19.8%`;

describe("resolveAnalysisTextForAssets", () => {
  it("prefers prior clean analysis over ASCII viz reply on follow-up", () => {
    const appHistory = [
      {
        id: "a1",
        role: "assistant" as const,
        type: "text" as const,
        content: ROHIT_ANALYSIS,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ];

    const resolved = resolveAnalysisTextForAssets(
      ASCII_VIZ_REPLY,
      appHistory,
      "do the viz of this expense"
    );

    expect(resolved).toContain("Room Rent");
    expect(resolved).not.toMatch(/[█░▓▌▊]/);
  });

  it("does not return prior hotel analysis when upload turn asks for cash flow", () => {
    const appHistory = [
      {
        id: "a1",
        role: "assistant" as const,
        type: "text" as const,
        content: ROHIT_ANALYSIS,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ];

    const currentAnalysis = `Cash inflows and outflows
Category	Amount
Operating inflow	5000
Operating outflow	3200`;

    const resolved = resolveAnalysisTextForAssets(
      currentAnalysis,
      appHistory,
      "do Cash Flow Management and some viz",
      { attachmentCount: 1, hasVision: true }
    );

    expect(resolved).toContain("Operating inflow");
    expect(resolved).not.toContain("Rohit Sharma");
  });
});

describe("extractAssetsFromChatAnalysis cash flow titles", () => {
  it("names assets from prompt topic instead of generic Data table labels", () => {
    const assets = extractAssetsFromChatAnalysis({
      chatText: `Category	Amount
Operating inflow	5000
Operating outflow	3200`,
      userInput: "do Cash Flow Management and some viz",
      workspaceId: "ws-1",
    });

    const table = assets.find((asset) => asset.kind === "table");
    const chart = assets.find((asset) => asset.kind === "chart");

    expect(table?.title).toContain("Cash flow");
    expect(chart?.title).toContain("Cash flow");
  });
});

describe("containsAsciiVizArtifacts", () => {
  it("detects block-character visualizations", () => {
    expect(containsAsciiVizArtifacts(ASCII_VIZ_REPLY)).toBe(true);
    expect(containsAsciiVizArtifacts(ROHIT_ANALYSIS)).toBe(false);
  });
});
