"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { useWorkspaces } from "@/contexts/workspace-context";

type WorkspacePageClientProps = {
  workspaceId: string;
};

export function WorkspacePageClient({ workspaceId }: WorkspacePageClientProps) {
  const { getWorkspace, isHydrated } = useWorkspaces();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const workspace = getWorkspace(workspaceId);

  if (!isClient || !isHydrated) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading workspace...</p>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-lg text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Workspace not found
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            This workspace may have been removed or the link is invalid.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkspaceShell workspaceId={workspace.id} workspaceName={workspace.name} />
    </div>
  );
}
