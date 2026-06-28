"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getOrCreateLedgerKey } from "@/lib/ledger/identity";
import { claimLedgerWorkspaces } from "@/lib/ledger/workspaces";
import type { LedgerScope } from "@/lib/ledger/scope";
import { getBrowserClient } from "@/lib/supabase/client";

type LedgerContextValue = {
  supabase: ReturnType<typeof getBrowserClient>;
  ledgerKey: string;
  userId: string | null;
  scope: LedgerScope | null;
  isReady: boolean;
  authSettled: boolean;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

function invalidateScopedQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
  void queryClient.invalidateQueries({ queryKey: ["assets"] });
  void queryClient.invalidateQueries({ queryKey: ["messages"] });
}

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [ledgerKey, setLedgerKey] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [authSettled, setAuthSettled] = useState(false);
  const supabase = useMemo(() => getBrowserClient(), []);

  useEffect(() => {
    setLedgerKey(getOrCreateLedgerKey());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || !ledgerKey) return;

    let cancelled = false;

    async function bootstrapSession() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      const sessionUserId = data.session?.user.id ?? null;

      if (sessionUserId) {
        await claimLedgerWorkspaces(
          { supabase, ledgerKey, userId: sessionUserId },
          sessionUserId
        );
      }

      if (cancelled) return;

      setUserId(sessionUserId);
      setAuthSettled(true);
    }

    void bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const nextUserId = session?.user.id ?? null;

      if (event === "SIGNED_IN" && nextUserId && ledgerKey) {
        await claimLedgerWorkspaces(
          { supabase, ledgerKey, userId: nextUserId },
          nextUserId
        );
      }

      setUserId(nextUserId);
      setAuthSettled(true);
      invalidateScopedQueries(queryClient);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isReady, ledgerKey, supabase, queryClient]);

  const scope = useMemo<LedgerScope | null>(() => {
    if (!isReady || !ledgerKey) return null;
    return { supabase, ledgerKey, userId };
  }, [isReady, ledgerKey, supabase, userId]);

  const value = useMemo(
    () => ({
      supabase,
      ledgerKey,
      userId,
      scope,
      isReady,
      authSettled,
    }),
    [supabase, ledgerKey, userId, scope, isReady, authSettled]
  );

  return (
    <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>
  );
}

export function useLedger() {
  const context = useContext(LedgerContext);
  if (!context) {
    throw new Error("useLedger must be used within a LedgerProvider");
  }
  return context;
}

export function useLedgerScope(): LedgerScope {
  const { scope, isReady, authSettled } = useLedger();
  if (!isReady || !authSettled || !scope) {
    throw new Error("Ledger scope is not ready");
  }
  return scope;
}

export function useOptionalLedgerScope(): LedgerScope | null {
  const { scope, isReady, authSettled } = useLedger();
  if (!isReady || !authSettled) return null;
  return scope;
}
