import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

type TableName = keyof Database["public"]["Tables"];

export function createMockSupabase(handlers: Partial<Record<TableName, unknown>> = {}) {
  const chain = (table: string) => {
    const handler = handlers[table as TableName];
    return handler ?? defaultChain();
  };

  return {
    from: vi.fn((table: string) => chain(table)),
  } as unknown as SupabaseClient<Database>;
}

function defaultChain() {
  const result = { data: [], error: null };
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const method of [
    "select",
    "insert",
    "upsert",
    "update",
    "delete",
    "eq",
    "or",
    "order",
    "maybeSingle",
    "single",
    "is",
    "not",
  ]) {
    api[method] = vi.fn(self);
  }
  api.then = (resolve: (value: typeof result) => void) => {
    resolve(result);
    return Promise.resolve(result);
  };
  return api;
}
