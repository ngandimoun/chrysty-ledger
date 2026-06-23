"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { NewWorkspaceDialog } from "@/components/workspace/new-workspace-dialog";
import { useWorkspaces } from "@/contexts/workspace-context";

export default function Home() {
  const router = useRouter();
  const { workspaces, isHydrated, createWorkspace } = useWorkspaces();
  const [isNewWorkspaceOpen, setIsNewWorkspaceOpen] = useState(false);

  useEffect(() => {
    if (!isHydrated || workspaces.length === 0) return;

    const mostRecent = [...workspaces].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    router.replace(`/workspace/${mostRecent.id}`);
  }, [isHydrated, workspaces, router]);

  function handleCreateWorkspace(name: string) {
    void createWorkspace(name).then((workspace) => {
      router.push(`/workspace/${workspace.id}`);
    });
  }

  if (!isHydrated) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (workspaces.length > 0) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <p className="text-sm text-muted-foreground">Opening workspace...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/20">
            <span className="text-lg font-bold text-primary">C</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Chrysty
            </span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Create your first workspace to start tracking expenses, receipts, and invoices
            with AI.
          </p>
          <button
            type="button"
            onClick={() => setIsNewWorkspaceOpen(true)}
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
          >
            <Plus className="size-4" />
            Create your first workspace
          </button>
        </div>
      </div>

      <NewWorkspaceDialog
        open={isNewWorkspaceOpen}
        onOpenChange={setIsNewWorkspaceOpen}
        onCreate={handleCreateWorkspace}
      />
    </>
  );
}
