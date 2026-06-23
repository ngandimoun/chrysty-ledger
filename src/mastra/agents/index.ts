import { Agent } from "@mastra/core/agent";

import { getLedgerMemory } from "@/mastra/memory/ledger-memory";
import { getLedgerModel } from "@/mastra/model";
import { ledgerTools } from "@/mastra/tools";

const sharedMemory = () => getLedgerMemory() ?? undefined;

export const ledgerAnalyst = new Agent({
  id: "ledger-analyst",
  name: "Ledger Analyst",
  instructions: `You are a financial analyst for Chrysty Ledger.
Read workspace working memory before analyzing.
Produce structured insights about expenses, cash flow, and trends.
Prefer concise, actionable summaries.`,
  model: getLedgerModel(),
  memory: sharedMemory(),
  tools: {
    listAssets: ledgerTools.listAssetsTool,
    getAsset: ledgerTools.getAssetTool,
  },
});

export const ledgerBookkeeper = new Agent({
  id: "ledger-bookkeeper",
  name: "Ledger Bookkeeper",
  instructions: `You prepare validated asset payloads for sheets, tables, and exports.
Never invent numbers — use provided data only.`,
  model: getLedgerModel(),
  memory: sharedMemory(),
  tools: {
    createAsset: ledgerTools.createAssetTool,
    updateAsset: ledgerTools.updateAssetTool,
    listAssets: ledgerTools.listAssetsTool,
  },
});

export const ledgerReporter = new Agent({
  id: "ledger-reporter",
  name: "Ledger Reporter",
  instructions: `You write executive accounting reports and narrative summaries.
Use workspace context and asset data when available.`,
  model: getLedgerModel(),
  memory: sharedMemory(),
  tools: {
    listAssets: ledgerTools.listAssetsTool,
    getAsset: ledgerTools.getAssetTool,
    createAsset: ledgerTools.createAssetTool,
  },
});

export const ledgerSupervisor = new Agent({
  id: "ledger-supervisor",
  name: "Ledger Supervisor",
  instructions: `You coordinate Chrysty Ledger workflows.
Read working memory, delegate analysis to the analyst, writes to the bookkeeper, reports to the reporter.
Update working memory when you learn durable business facts.

Task completion rubric:
- Analysis tasks are complete when trends, totals, and at least one actionable recommendation are stated.
- Import tasks are complete when row counts are validated and merge conflicts are resolved.
- Report tasks are complete when executive summary and key metrics are included.
Stop delegating once the rubric is satisfied.`,
  model: getLedgerModel(),
  memory: sharedMemory(),
  agents: {
    analyst: ledgerAnalyst,
    bookkeeper: ledgerBookkeeper,
    reporter: ledgerReporter,
  },
  tools: {
    listAssets: ledgerTools.listAssetsTool,
    triggerJob: ledgerTools.triggerLedgerJobTool,
  },
  backgroundTasks: {
    tools: {
      analyst: { enabled: true, timeoutMs: 280_000 },
      reporter: { enabled: true, timeoutMs: 280_000 },
    },
  },
});
