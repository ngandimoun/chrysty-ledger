"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Folder, PanelLeftClose, Plus } from "lucide-react";

import { AssetsExplorerPanel } from "@/components/workspace/assets-explorer/assets-explorer-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useWorkspaceSidebar } from "@/contexts/workspace-sidebar-context";
import {
  getUserFirstName,
  useUserProfileQuery,
} from "@/hooks/queries/use-user-profile-query";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/workspaces";

const sidebarTransition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

type SidebarProps = {
  isOpen: boolean;
  isMobile?: boolean;
  workspaces: Workspace[];
  activeWorkspaceId?: string;
  onClose: () => void;
  onNewWorkspace: () => void;
  onSelectWorkspace: (id: string) => void;
};

type SidebarContentProps = {
  workspaces: Workspace[];
  activeWorkspaceId?: string;
  isMobile?: boolean;
  onClose: () => void;
  onNewWorkspace: () => void;
  onSelectWorkspace: (id: string) => void;
};

function SidebarContent({
  workspaces,
  activeWorkspaceId,
  isMobile,
  onClose,
  onNewWorkspace,
  onSelectWorkspace,
}: SidebarContentProps) {
  const { explorerState } = useWorkspaceSidebar();
  const { data: userProfile } = useUserProfileQuery();
  const firstName = userProfile ? getUserFirstName(userProfile) : null;

  const showAssets =
    explorerState !== null &&
    activeWorkspaceId !== undefined &&
    explorerState.workspaceId === activeWorkspaceId;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {userProfile?.avatarUrl ? (
            <img
              src={userProfile.avatarUrl}
              alt=""
              className="size-7 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border"
            />
          ) : (
            <div
              aria-hidden
              className="size-7 shrink-0 rounded-full bg-sidebar-accent ring-1 ring-sidebar-border"
            />
          )}
          <span className="truncate text-sm font-semibold text-sidebar-foreground">
            {firstName ?? "…"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close sidebar"
          className="shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:size-8"
        >
          <PanelLeftClose className="size-5 md:size-4" />
        </Button>
      </div>

      <nav className="flex shrink-0 flex-col gap-1 px-2 py-2 sm:px-3">
        <p className="px-3 pb-1 text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">
          Workspaces
        </p>
        <button
          type="button"
          onClick={onNewWorkspace}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Plus className="size-5 shrink-0 md:size-4 text-sidebar-foreground/60" />
          <span>New Workspace</span>
        </button>

        {workspaces.map((workspace) => {
          const isActive = workspace.id === activeWorkspaceId;

          return (
            <Link
              key={workspace.id}
              href={`/workspace/${workspace.id}`}
              onClick={() => onSelectWorkspace(workspace.id)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-primary/12 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Folder
                className={cn(
                  "size-5 shrink-0 md:size-4",
                  isActive ? "text-primary" : "text-sidebar-foreground/60"
                )}
              />
              <span className="truncate">{workspace.name}</span>
            </Link>
          );
        })}
      </nav>

      {showAssets && explorerState && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-sidebar-border">
          <p className="shrink-0 px-5 pt-2 pb-1 text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">
            Assets
          </p>
          <AssetsExplorerPanel
            workspaceId={explorerState.workspaceId}
            groupedAssets={explorerState.groupedAssets}
            searchQuery={explorerState.searchQuery}
            onSearchChange={explorerState.onSearchChange}
            activeAssetId={explorerState.activeAssetId}
            onSelectAsset={explorerState.onSelectAsset}
            onAddToChat={explorerState.onAddAssetToChat}
            onAssetSelect={isMobile ? onClose : undefined}
          />
        </div>
      )}

      <div
        className={cn(
          "shrink-0 border-t border-sidebar-border p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:p-3",
          !showAssets && "mt-auto"
        )}
      >
        <div className="flex min-h-11 items-center justify-between gap-2 px-3 py-2">
          <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-xs font-medium text-transparent">
            Made in Chrysty
          </span>
          <ThemeToggle className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  isOpen,
  isMobile,
  workspaces,
  activeWorkspaceId,
  onClose,
  onNewWorkspace,
  onSelectWorkspace,
}: SidebarProps) {
  const contentProps = {
    workspaces,
    activeWorkspaceId,
    isMobile,
    onClose,
    onNewWorkspace,
    onSelectWorkspace,
  };

  if (isMobile) {
    return (
      <>
        <motion.div
          initial={false}
          animate={{
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? "auto" : "none",
          }}
          transition={{ duration: 0.2 }}
          className={cn(
            "fixed inset-0 z-40 bg-overlay backdrop-blur-[2px]",
            !isOpen && "invisible"
          )}
          onClick={onClose}
          aria-hidden={!isOpen}
        />

        <motion.aside
          initial={false}
          animate={{ x: isOpen ? 0 : "-100%" }}
          transition={sidebarTransition}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[min(85vw,18rem)] flex-col border-r border-sidebar-border bg-sidebar shadow-xl",
            !isOpen && "pointer-events-none"
          )}
          aria-hidden={!isOpen}
        >
          <SidebarContent {...contentProps} />
        </motion.aside>
      </>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 260 : 0 }}
      transition={sidebarTransition}
      className="relative z-20 hidden shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar md:flex md:flex-col"
      aria-hidden={!isOpen}
    >
      <div className="flex h-full w-[260px] flex-col">
        <SidebarContent {...contentProps} />
      </div>
    </motion.aside>
  );
}
