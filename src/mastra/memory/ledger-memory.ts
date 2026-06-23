import "server-only";

import { Memory } from "@mastra/memory";
import { PostgresStore, PgVector } from "@mastra/pg";

import { ledgerWorkingMemorySchema } from "@/lib/schemas/ledger-working-memory";
import { getLedgerMemoryModel } from "@/mastra/model";
import { isMastraStorageConfigured } from "@/lib/agent/mastra-enabled";

let ledgerMemoryInstance: Memory | null = null;

export function getLedgerMemory(): Memory | null {
  if (!isMastraStorageConfigured()) {
    return null;
  }

  if (!ledgerMemoryInstance) {
    const connectionString = process.env.DATABASE_URL!;
    const storage = new PostgresStore({
      id: "ledger-mastra-storage",
      connectionString,
      ssl: { rejectUnauthorized: false },
    });

    ledgerMemoryInstance = new Memory({
      storage,
      vector: new PgVector({
        id: "ledger-mastra-vector",
        connectionString,
        ssl: { rejectUnauthorized: false },
      }),
      embedder: process.env.OPENAI_API_KEY
        ? "openai/text-embedding-3-small"
        : undefined,
      options: {
        lastMessages: 20,
        generateTitle: process.env.OPENAI_API_KEY
          ? { model: "openai/gpt-4o-mini" }
          : undefined,
        observationalMemory: {
          model: getLedgerMemoryModel(),
          scope: "thread",
          temporalMarkers: true,
          observation: { messageTokens: 30_000 },
        },
        workingMemory: {
          enabled: true,
          scope: "thread",
          schema: ledgerWorkingMemorySchema,
        },
        semanticRecall: process.env.OPENAI_API_KEY
          ? {
              topK: 5,
              messageRange: 2,
              scope: "thread",
            }
          : undefined,
      },
    });
  }

  return ledgerMemoryInstance;
}
