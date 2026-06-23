"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { useLedger } from "@/contexts/ledger-context";
import { migrateLocalStorageIfNeeded } from "@/lib/ledger/migrate-local";
import { createWorkspace as createLedgerWorkspace, listWorkspaces } from "@/lib/ledger/workspaces";
import type { Workspace } from "@/lib/workspaces";

type WorkspaceContextValue = {
  workspaces: Workspace[];
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  createWorkspace: (name: string) => Promise<Workspace>;
  getWorkspace: (id: string) => Workspace | undefined;
  refreshWorkspaces: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { scope, isReady: isLedgerReady } = useLedger();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshWorkspaces = useCallback(async () => {
    if (!scope) return;

    setIsLoading(true);
    setError(null);

    try {
      const rows = await listWorkspaces(scope);
      setWorkspaces(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load workspaces";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
      setIsHydrated(true);
    }
  }, [scope]);

  useEffect(() => {
    if (!isLedgerReady || !scope) return;
    const activeScope = scope;

    let cancelled = false;

    async function bootstrap() {
      try {
        await migrateLocalStorageIfNeeded(activeScope);
        if (cancelled) return;
        await refreshWorkspaces();
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to initialize workspaces";
        setError(message);
        toast.error(message);
        setIsHydrated(true);
        setIsLoading(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isLedgerReady, scope, refreshWorkspaces]);

  const createWorkspace = useCallback(
    async (name: string) => {
      if (!scope) {
        throw new Error("Ledger is not ready");
      }

      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("Workspace name cannot be empty");
      }

      const workspace = await createLedgerWorkspace(scope, trimmed);
      setWorkspaces((current) => [...current, workspace]);
      return workspace;
    },
    [scope]
  );

  const getWorkspace = useCallback(
    (id: string) => workspaces.find((workspace) => workspace.id === id),
    [workspaces]
  );

  const value = useMemo(
    () => ({
      workspaces,
      isHydrated,
      isLoading,
      error,
      createWorkspace,
      getWorkspace,
      refreshWorkspaces,
    }),
    [
      workspaces,
      isHydrated,
      isLoading,
      error,
      createWorkspace,
      getWorkspace,
      refreshWorkspaces,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspaces() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaces must be used within a WorkspaceProvider");
  }
  return context;
}
