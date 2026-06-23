"use client";

import { X } from "lucide-react";
import { motion } from "framer-motion";

import { ChatPanelToggle } from "@/components/workspace/chat-panel-toggle";
import { ArtifactChart } from "@/components/workspace/artifact-chart";
import { ArtifactTable } from "@/components/workspace/artifact-table";
import { Button } from "@/components/ui/button";
import type { WorkspaceArtifact } from "@/lib/artifact-types";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const panelTransition = { duration: 0.24, ease: [0.4, 0, 0.2, 1] as const };

type WorkspaceCanvasProps = {
  artifact: WorkspaceArtifact;
  isChatOpen: boolean;
  onClose: () => void;
  onHideChat: () => void;
  onShowChat: () => void;
  panelWidthPercent?: number;
  isFullWidth?: boolean;
};

export function WorkspaceCanvas({
  artifact,
  isChatOpen,
  onClose,
  onHideChat,
  onShowChat,
  panelWidthPercent = 58,
  isFullWidth = false,
}: WorkspaceCanvasProps) {
  const isMobile = useIsMobile();

  const content = (
    <>
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {artifact.title}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {!isMobile && (
            <ChatPanelToggle
              isChatOpen={isChatOpen}
              onHideChat={onHideChat}
              onShowChat={onShowChat}
            />
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close canvas">
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {artifact.kind === "table" && <ArtifactTable artifact={artifact} />}
        {artifact.kind === "chart" && <ArtifactChart artifact={artifact} />}
        {artifact.kind === "file-list" && (
          <ul className="flex flex-col gap-2">
            {artifact.files.map((file) => (
              <li
                key={file.name}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
              >
                <span className="truncate text-foreground">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">{file.size}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0, x: "100%" }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: "100%" }}
        transition={panelTransition}
        className="fixed inset-0 z-50 flex flex-col bg-background"
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{
        width: isFullWidth ? "100%" : `${panelWidthPercent}%`,
        opacity: 1,
      }}
      exit={{ width: 0, opacity: 0 }}
      transition={panelTransition}
      className={cn("flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-background")}
    >
      {content}
    </motion.aside>
  );
}
