import { z } from "zod";

export const ledgerWorkingMemorySchema = z.object({
  businessName: z.string().optional(),
  industry: z.string().optional(),
  fiscalYearStart: z.string().optional(),
  currency: z.string().optional(),
  accountingBasis: z.enum(["cash", "accrual"]).optional(),
  knownVendors: z.array(z.string()).optional(),
  recurringExpenses: z.array(z.string()).optional(),
  openGoals: z.array(z.string()).optional(),
  lastMajorAnalysis: z.string().optional(),
  preferences: z
    .object({
      reportStyle: z.string().optional(),
      dashboardKpis: z.array(z.string()).optional(),
    })
    .optional(),
  recentAssets: z
    .array(
      z.object({
        assetId: z.string(),
        title: z.string(),
        kind: z.string(),
        createdAt: z.string(),
      })
    )
    .optional(),
  lastTurn: z
    .object({
      route: z.enum(["chat", "search", "create_asset"]).optional(),
      summary: z.string().optional(),
      attachmentNames: z.array(z.string()).optional(),
      searchTopic: z.string().optional(),
    })
    .optional(),
});

export type LedgerWorkingMemory = z.infer<typeof ledgerWorkingMemorySchema>;
