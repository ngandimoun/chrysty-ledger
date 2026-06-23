import "server-only";

import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";

import {
  ledgerAnalyst,
  ledgerBookkeeper,
  ledgerReporter,
  ledgerSupervisor,
} from "@/mastra/agents";
import { getLedgerMemory } from "@/mastra/memory/ledger-memory";
import { ledgerTools } from "@/mastra/tools";
import { bulkImportWorkflow } from "@/mastra/workflows/bulk-import";
import { expenseAnalysisWorkflow } from "@/mastra/workflows/expense-analysis";
import { scheduledReportWorkflow } from "@/mastra/workflows/scheduled-report";
import { isMastraStorageConfigured } from "@/lib/agent/mastra-enabled";

let mastraInstance: Mastra | null = null;

export function getMastra(): Mastra | null {
  if (!isMastraStorageConfigured()) {
    return null;
  }

  if (!mastraInstance) {
    const connectionString = process.env.DATABASE_URL!;
    const storage = new PostgresStore({
      id: "ledger-mastra-storage",
      connectionString,
      ssl: { rejectUnauthorized: false },
    });

    getLedgerMemory();

    mastraInstance = new Mastra({
      storage,
      backgroundTasks: { enabled: true, defaultTimeoutMs: 280_000 },
      agents: {
        ledgerSupervisor,
        ledgerAnalyst,
        ledgerBookkeeper,
        ledgerReporter,
      },
      tools: ledgerTools,
      workflows: {
        bulkImport: bulkImportWorkflow,
        expenseAnalysis: expenseAnalysisWorkflow,
        scheduledReport: scheduledReportWorkflow,
      },
    });
  }

  return mastraInstance;
}
