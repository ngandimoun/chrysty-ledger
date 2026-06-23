import { MessageSquare, PanelLeftClose } from "lucide-react";

import { Button } from "@/components/ui/button";

type ChatPanelToggleProps = {
  isChatOpen: boolean;
  onHideChat: () => void;
  onShowChat: () => void;
};

export function ChatPanelToggle({
  isChatOpen,
  onHideChat,
  onShowChat,
}: ChatPanelToggleProps) {
  if (isChatOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onHideChat}
        className="h-8 shrink-0 gap-1.5 px-2 text-xs"
      >
        <PanelLeftClose className="size-3.5" />
        Hide chat
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onShowChat}
      className="h-8 shrink-0 gap-1.5 px-2 text-xs"
    >
      <MessageSquare className="size-3.5" />
      Show chat
    </Button>
  );
}
