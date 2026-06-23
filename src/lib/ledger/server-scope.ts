import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { normalizeScopeUserId, type LedgerScope } from "@/lib/ledger/scope";
import type { Database } from "@/lib/supabase/database.types";

export type LedgerRequestIdentity = {
  ledgerKey: string;
  userId: string | null;
};

function createServerSupabase(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceRoleKey ?? anonKey;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key (SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }

  return createClient<Database>(url, key);
}

export function createLedgerScope(identity: LedgerRequestIdentity): LedgerScope {
  const ledgerKey = identity.ledgerKey.trim();
  return {
    supabase: createServerSupabase(),
    ledgerKey,
    userId: normalizeScopeUserId(ledgerKey, identity.userId),
  };
}

export function parseLedgerIdentityFromHeaders(request: Request): LedgerRequestIdentity | null {
  const ledgerKey = request.headers.get("x-ledger-key")?.trim();
  if (!ledgerKey) return null;

  const userId = request.headers.get("x-ledger-user-id")?.trim() || null;
  return { ledgerKey, userId };
}

export async function parseLedgerIdentityFromBody(
  request: Request
): Promise<LedgerRequestIdentity | null> {
  const fromHeaders = parseLedgerIdentityFromHeaders(request);
  if (fromHeaders) return fromHeaders;

  try {
    const body = (await request.clone().json()) as {
      ledgerKey?: string;
      userId?: string | null;
    };
    if (!body.ledgerKey?.trim()) return null;
    return {
      ledgerKey: body.ledgerKey.trim(),
      userId: body.userId ?? null,
    };
  } catch {
    return null;
  }
}
