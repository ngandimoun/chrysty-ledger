"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AskChrystyButton, ChrystyHostContext } from "@chrysty/live-embed";
import { PanelLeft } from "lucide-react";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/sidebar";
import { NewWorkspaceDialog } from "@/components/workspace/new-workspace-dialog";
import { useWorkspaces } from "@/contexts/workspace-context";
import { useIsMobile } from "@/hooks/use-mobile";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const router = useRouter();
  const { workspaces, createWorkspace } = useWorkspaces();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNewWorkspaceOpen, setIsNewWorkspaceOpen] = useState(false);

  const activeWorkspaceId = useMemo(() => {
    const match = pathname.match(/^\/workspace\/([^/]+)$/);
    return match?.[1];
  }, [pathname]);

  useEffect(() => {
    if (isMobile === true) {
      setIsSidebarOpen(false);
    } else if (isMobile === false) {
      setIsSidebarOpen(true);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, isSidebarOpen]);

  useEffect(() => {
    if (!isSidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSidebarOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSidebarOpen]);

  function handleCreateWorkspace(name: string) {
    void createWorkspace(name).then((workspace) => {
      router.push(`/workspace/${workspace.id}`);
      setIsSidebarOpen(false);
    });
  }

  function handleSelectWorkspace() {
    setIsSidebarOpen(false);
  }

  if (pathname?.startsWith("/auth/")) {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <ChrystyHostContext
        source="ledger_workspace"
        title="Ledger"
        captureTarget="#workspace-content"
        worker="ledger"
        entityId={pathname}
      >
        <div className="flex h-dvh overflow-hidden bg-background">
          <Sidebar
            isOpen={isSidebarOpen}
            isMobile={isMobile}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onClose={() => setIsSidebarOpen(false)}
            onNewWorkspace={() => setIsNewWorkspaceOpen(true)}
            onSelectWorkspace={handleSelectWorkspace}
          />

          <NewWorkspaceDialog
            open={isNewWorkspaceOpen}
            onOpenChange={setIsNewWorkspaceOpen}
            onCreate={handleCreateWorkspace}
          />

          <div className="relative flex min-w-0 flex-1 flex-col bg-background">
            {!isSidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open sidebar"
                className="fixed top-[max(env(safe-area-inset-top),0.75rem)] left-3 z-30 shrink-0 text-muted-foreground hover:bg-muted hover:text-primary md:size-8"
              >
                <PanelLeft className="size-5 md:size-4" />
              </Button>
            )}

            <main
              id="workspace-content"
              data-chrysty-capture
              className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain pt-[max(env(safe-area-inset-top),0px)] pb-[max(env(safe-area-inset-bottom),0px)]"
            >
              {children}
            </main>
          </div>
        </div>
        <AskChrystyButton />
      </ChrystyHostContext>
    </AuthGuard>
  );
}
