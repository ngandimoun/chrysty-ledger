"use client";

import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowUp,
  Paperclip,
  Square,
  X,
  StopCircle,
  Mic,
  Globe,
  BrainCog,
  FolderCode,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import type { ChatRequestMode, ChatSendOptions, AssetRef } from "@/lib/chat-types";
import {
  CHAT_FILE_ACCEPT,
  getAttachmentRejectionReason,
} from "@/lib/ai/supported-attachments";
import {
  canDecodeImageFile,
  getFilePreviewKey,
  revokeFilePreviewUrls,
} from "@/lib/chat-attachment-previews";
import { useVoiceRecording } from "@/hooks/use-voice-recording";
import { transcribeSpeech } from "@/lib/speech-api-client";
import type { WorkspaceAsset } from "@/lib/asset-types";
import type { AssetCategory } from "@/lib/asset-types";
import { AssetMentionPopover } from "@/components/workspace/asset-mention-popover";
import { getAssetListIcon, getAssetCategoryIcon } from "@/components/workspace/assets-explorer/asset-utils";
import { cn } from "@/lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[44px] w-full resize-none rounded-md border-none bg-transparent px-3 py-2.5 text-base text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      rows={1}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-[#333333] bg-[#1F2023] px-3 py-1.5 text-sm text-white shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[90vw] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border border-[#333333] bg-[#1F2023] p-0 shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 md:max-w-[800px]",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute top-4 right-4 z-10 rounded-full bg-[#2E3033]/80 p-2 transition-all hover:bg-[#2E3033]">
        <X className="h-5 w-5 text-gray-200 hover:text-white" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg leading-none font-semibold tracking-tight text-gray-100",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-white hover:bg-white/80 text-black",
      outline: "border border-[#444444] bg-transparent hover:bg-[#3A3A40]",
      ghost: "bg-transparent hover:bg-[#3A3A40]",
    };
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6",
      icon: "h-8 w-8 rounded-full aspect-[1/1]",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

interface VoiceRecorderProps {
  durationSeconds: number;
  visualizerBars?: number;
}
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  durationSeconds,
  visualizerBars = 32,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex w-full flex-col items-center justify-center py-3 transition-all duration-300">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <span className="font-mono text-sm text-white/80">{formatTime(durationSeconds)}</span>
      </div>
      <div className="flex h-10 w-full items-center justify-center gap-0.5 px-4">
        {[...Array(visualizerBars)].map((_, i) => (
          <div
            key={i}
            className="w-0.5 animate-pulse rounded-full bg-white/50"
            style={{
              height: `${Math.max(15, Math.random() * 100)}%`,
              animationDelay: `${i * 0.05}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

interface ImageViewDialogProps {
  imageUrl: string | null;
  onClose: () => void;
}
const ImageViewDialog: React.FC<ImageViewDialogProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[90vw] border-none bg-transparent p-0 shadow-none md:max-w-[800px]">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative overflow-hidden rounded-2xl bg-[#1F2023] shadow-2xl"
        >
          <img
            src={imageUrl}
            alt="Full preview"
            className="max-h-[80vh] w-full rounded-2xl object-contain"
          />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
});
function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 240,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              "ai-prompt-box rounded-3xl border border-[#444444] bg-[#1F2023] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300",
              isLoading && "border-red-500/70",
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

const MIN_TEXTAREA_HEIGHT = 44;

function getMaxHeightPx(maxHeight: number | string): number {
  if (typeof maxHeight === "number") return maxHeight;
  const parsed = parseInt(String(maxHeight), 10);
  return Number.isFinite(parsed) ? parsed : 240;
}

function resizePromptTextarea(
  textarea: HTMLTextAreaElement,
  value: string,
  maxHeight: number | string
) {
  if (!value.trim()) {
    textarea.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    return;
  }

  textarea.style.height = "auto";
  const maxHeightPx = getMaxHeightPx(maxHeight);
  const nextHeight = Math.min(textarea.scrollHeight, maxHeightPx);
  textarea.style.height = `${Math.max(MIN_TEXTAREA_HEIGHT, nextHeight)}px`;
}

interface PromptInputTextareaProps {
  disableAutosize?: boolean;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}
const PromptInputTextarea: React.FC<
  PromptInputTextareaProps & React.ComponentProps<typeof Textarea>
> = ({ className, onKeyDown, disableAutosize = false, placeholder, inputRef, ...props }) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const setRefs = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      if (inputRef) {
        inputRef.current = node;
      }
    },
    [inputRef]
  );

  const syncHeight = React.useCallback(() => {
    if (disableAutosize || !textareaRef.current) return;
    resizePromptTextarea(textareaRef.current, value, maxHeight);
  }, [value, maxHeight, disableAutosize]);

  React.useEffect(() => {
    syncHeight();
  }, [syncHeight]);

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const observer = new ResizeObserver(() => {
      resizePromptTextarea(textarea, textarea.value, maxHeight);
    });

    observer.observe(textarea);
    return () => observer.disconnect();
  }, [value, maxHeight, disableAutosize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <Textarea
      ref={setRefs}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn("text-base", className)}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
};

interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {}
const PromptInputActions: React.FC<PromptInputActionsProps> = ({
  children,
  className,
  ...props
}) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}
const PromptInputAction: React.FC<PromptInputActionProps> = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

const CustomDivider: React.FC = () => (
  <div className="relative mx-1 h-6 w-[1.5px]">
    <div
      className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-[#9b87f5]/70 to-transparent"
      style={{
        clipPath:
          "polygon(0% 0%, 100% 0%, 100% 40%, 140% 50%, 100% 60%, 100% 100%, 0% 100%, 0% 60%, -40% 50%, 0% 40%)",
      }}
    />
  </div>
);

interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[], options?: ChatSendOptions) => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  showModeToggles?: boolean;
  maxHeight?: number | string;
  assetRefs?: AssetRef[];
  mentionAssets?: WorkspaceAsset[];
  onRemoveAssetRef?: (assetId: string) => void;
  onAddMentionAsset?: (asset: WorkspaceAsset) => void;
  onRegisterFocus?: (focus: (() => void) | null) => void;
  ledgerKey?: string;
  userId?: string | null;
}
export const PromptInputBox = React.forwardRef(
  (props: PromptInputBoxProps, ref: React.Ref<HTMLDivElement>) => {
    const {
      onSend = () => {},
      onStop,
      isLoading = false,
      placeholder = "Type your message here...",
      className,
      showModeToggles = true,
      maxHeight,
      assetRefs = [],
      mentionAssets = [],
      onRemoveAssetRef,
      onAddMentionAsset,
      onRegisterFocus,
      ledgerKey,
      userId,
    } = props;
    const [input, setInput] = React.useState("");
    const [mentionOpen, setMentionOpen] = React.useState(false);
    const [mentionQuery, setMentionQuery] = React.useState("");
    const [mentionStart, setMentionStart] = React.useState<number | null>(null);
    const [mentionIndex, setMentionIndex] = React.useState(0);
    const [files, setFiles] = React.useState<File[]>([]);
    const [filePreviews, setFilePreviews] = React.useState<{ [key: string]: string }>({});
    const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
    const [isTranscribing, setIsTranscribing] = React.useState(false);
    const [showSearch, setShowSearch] = React.useState(false);
    const [showThink, setShowThink] = React.useState(false);
    const [showCanvas, setShowCanvas] = React.useState(false);
    const uploadInputRef = React.useRef<HTMLInputElement>(null);
    const promptBoxRef = React.useRef<HTMLDivElement>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const filePreviewsRef = React.useRef<Record<string, string>>({});
    React.useEffect(() => {
      onRegisterFocus?.(() => {
        textareaRef.current?.focus();
      });
      return () => onRegisterFocus?.(null);
    }, [onRegisterFocus]);

    React.useEffect(() => {
      setMentionIndex(0);
    }, [mentionQuery]);
    const {
      isRecording,
      durationSeconds,
      startRecording,
      stopRecording,
    } = useVoiceRecording();

    const handleToggleChange = (value: string) => {
      if (value === "search") {
        setShowSearch((prev) => !prev);
        setShowThink(false);
      } else if (value === "think") {
        setShowThink((prev) => !prev);
        setShowSearch(false);
      }
    };

    const handleCanvasToggle = () => setShowCanvas((prev) => !prev);

    const isImageFile = (file: File) => file.type.startsWith("image/");

    const resolveMode = (): ChatRequestMode => {
      if (showSearch) return "search";
      if (showThink) return "think";
      if (showCanvas) return "canvas";
      return "default";
    };

    const closeMention = React.useCallback(() => {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
      setMentionIndex(0);
    }, []);

    const handleInputChange = React.useCallback(
      (value: string) => {
        setInput(value);

        const caret = textareaRef.current?.selectionStart ?? value.length;
        const beforeCaret = value.slice(0, caret);
        const atIndex = beforeCaret.lastIndexOf("@");

        if (atIndex >= 0) {
          const query = beforeCaret.slice(atIndex + 1);
          const charBeforeAt = atIndex > 0 ? beforeCaret[atIndex - 1] : " ";
          if ((charBeforeAt === " " || charBeforeAt === "\n" || atIndex === 0) && !query.includes(" ")) {
            setMentionOpen(true);
            setMentionQuery(query);
            setMentionStart(atIndex);
            setMentionIndex(0);
            return;
          }
        }

        closeMention();
      },
      [closeMention]
    );

    const selectMentionAsset = React.useCallback(
      (asset: WorkspaceAsset) => {
        onAddMentionAsset?.(asset);

        if (mentionStart !== null) {
          const caret = textareaRef.current?.selectionStart ?? input.length;
          const before = input.slice(0, mentionStart);
          const after = input.slice(caret);
          const nextValue = `${before}${after}`.replace(/\s{2,}/g, " ");
          setInput(nextValue.trimStart());
        }

        closeMention();
        requestAnimationFrame(() => textareaRef.current?.focus());
      },
      [closeMention, input, mentionStart, onAddMentionAsset]
    );

    const filteredMentionAssets = React.useMemo(() => {
      const normalizedQuery = mentionQuery.trim().toLowerCase();
      return mentionAssets.filter((asset) => {
        if (!normalizedQuery) return true;
        return (
          asset.title.toLowerCase().includes(normalizedQuery) ||
          asset.kind.toLowerCase().includes(normalizedQuery) ||
          asset.category.toLowerCase().includes(normalizedQuery)
        );
      });
    }, [mentionAssets, mentionQuery]);

    const handleMentionKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!mentionOpen || filteredMentionAssets.length === 0) return;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setMentionIndex((current) =>
            Math.min(current + 1, Math.min(filteredMentionAssets.length, 8) - 1)
          );
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setMentionIndex((current) => Math.max(current - 1, 0));
          return;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const asset = filteredMentionAssets[mentionIndex];
          if (asset) selectMentionAsset(asset);
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          closeMention();
        }
      },
      [
        closeMention,
        filteredMentionAssets,
        mentionIndex,
        mentionOpen,
        selectMentionAsset,
      ]
    );

    const getAssetRefIcon = React.useCallback(
      (ref: AssetRef) => {
        const asset = mentionAssets.find((item) => item.id === ref.id);
        if (asset) return getAssetListIcon(asset.payload);
        return getAssetCategoryIcon(ref.category as AssetCategory);
      },
      [mentionAssets]
    );

    filePreviewsRef.current = filePreviews;

    const clearFilePreviews = React.useCallback(() => {
      setFilePreviews((current) => {
        revokeFilePreviewUrls(current);
        return {};
      });
    }, []);

    const processFile = React.useCallback(async (file: File) => {
      const rejection = getAttachmentRejectionReason({
        name: file.name,
        type: file.type,
        size: file.size,
      });
      if (rejection) {
        toast.error(rejection);
        return;
      }

      if (isImageFile(file)) {
        const decodable = await canDecodeImageFile(file);
        if (!decodable) {
          toast.error(
            `"${file.name}" is not a valid image. Choose a PNG, JPEG, or WebP from your device.`
          );
          return;
        }
      }

      const previewKey = getFilePreviewKey(file);

      setFiles((current) => {
        if (current.some((existing) => getFilePreviewKey(existing) === previewKey)) {
          return current;
        }
        return [...current, file];
      });

      if (isImageFile(file)) {
        const previewUrl = URL.createObjectURL(file);
        setFilePreviews((current) => ({
          ...current,
          [previewKey]: previewUrl,
        }));
      }
    }, []);

    const processFiles = React.useCallback(
      (incoming: File[]) => {
        for (const file of incoming) {
          void processFile(file);
        }
      },
      [processFile]
    );

    React.useEffect(() => {
      return () => {
        revokeFilePreviewUrls(filePreviewsRef.current);
      };
    }, []);

    const handleDragOver = React.useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    }, []);

    const handleDragLeave = React.useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    }, []);

    const handleDrop = React.useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 0) processFiles(droppedFiles);
      },
      [processFiles]
    );

    const handleRemoveFile = (index: number) => {
      const fileToRemove = files[index];
      if (!fileToRemove) return;

      const previewKey = getFilePreviewKey(fileToRemove);
      const previewUrl = filePreviews[previewKey];
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      if (selectedImage === previewUrl) {
        setSelectedImage(null);
      }

      setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
      setFilePreviews((current) => {
        if (!current[previewKey]) return current;
        const next = { ...current };
        delete next[previewKey];
        return next;
      });
    };

    const openImageModal = (imageUrl: string) => setSelectedImage(imageUrl);

    const handlePaste = React.useCallback(
      (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              processFile(file);
              break;
            }
          }
        }
      },
      [processFile]
    );

    React.useEffect(() => {
      document.addEventListener("paste", handlePaste);
      return () => document.removeEventListener("paste", handlePaste);
    }, [handlePaste]);

    const handleSubmit = () => {
      if (isLoading) return;
      if (input.trim() || files.length > 0 || assetRefs.length > 0) {
        onSend(input, files, { mode: resolveMode(), assetRefs });
        setInput("");
        setFiles([]);
        clearFilePreviews();
        setSelectedImage(null);
        setShowSearch(false);
        setShowThink(false);
        setShowCanvas(false);
        closeMention();
      }
    };

    const hasContent = input.trim() !== "" || files.length > 0 || assetRefs.length > 0;
    const isVoiceBusy = isRecording || isTranscribing;

    const handleVoiceButtonClick = async () => {
      if (isLoading) {
        onStop?.();
        return;
      }

      if (isTranscribing) return;

      if (isRecording) {
        setIsTranscribing(true);
        try {
          if (!ledgerKey?.trim()) {
            toast.error("Ledger is not ready.");
            return;
          }

          const blob = await stopRecording();
          if (!blob || blob.size === 0) {
            toast.error("No audio recorded.");
            return;
          }

          const transcript = await transcribeSpeech(blob, { ledgerKey, userId });
          setInput((current) =>
            current.trim() ? `${current.trim()} ${transcript}` : transcript
          );
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Transcription failed."
          );
        } finally {
          setIsTranscribing(false);
        }
        return;
      }

      if (hasContent) {
        handleSubmit();
        return;
      }

      try {
        await startRecording();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Microphone permission was denied."
        );
      }
    };

    return (
      <>
        <PromptInput
          value={input}
          onValueChange={handleInputChange}
          isLoading={isLoading}
          maxHeight={maxHeight}
          onSubmit={handleSubmit}
          className={cn(
            "w-full border-[#444444] bg-[#1F2023] shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300 ease-in-out",
            isRecording && "border-red-500/70",
            isTranscribing && "border-[#9b87f5]/50",
            className
          )}
          disabled={isVoiceBusy}
          ref={ref || promptBoxRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {files.length > 0 && !isRecording && (
            <div className="flex flex-wrap gap-2 p-0 pb-1 transition-all duration-300">
              {files.map((file, index) => {
                const previewKey = getFilePreviewKey(file);
                const previewUrl = filePreviews[previewKey];

                return (
                <div key={previewKey} className="group relative">
                  {file.type.startsWith("image/") ? (
                    previewUrl ? (
                    <div
                      className="h-16 w-16 cursor-pointer overflow-hidden rounded-xl transition-all duration-300"
                      onClick={() => openImageModal(previewUrl)}
                    >
                      <img
                        src={previewUrl}
                        alt={file.name}
                        className="h-full w-full object-cover"
                        decoding="async"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(index);
                        }}
                        className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                    ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#2E3033]">
                      <Loader2 className="h-4 w-4 animate-spin text-[#9CA3AF]" />
                    </div>
                    )
                  ) : (
                    <div className="relative flex max-w-[180px] items-center gap-2 rounded-xl border border-[#444444] bg-[#2E3033] px-3 py-2 text-xs text-[#D1D5DB]">
                      <Paperclip className="h-4 w-4 shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="absolute -top-1 -right-1 rounded-full bg-black/70 p-0.5"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {assetRefs.length > 0 && !isRecording && (
            <div className="flex flex-wrap gap-2 p-0 pb-1">
              {assetRefs.map((ref) => {
                const Icon = getAssetRefIcon(ref);
                return (
                  <div
                    key={ref.id}
                    className="relative flex max-w-[200px] items-center gap-2 rounded-xl border border-[#9b87f5]/40 bg-[#9b87f5]/10 px-3 py-1.5 text-xs text-[#E9D5FF]"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{ref.title}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveAssetRef?.(ref.id)}
                      className="absolute -top-1 -right-1 rounded-full bg-black/70 p-0.5"
                      aria-label={`Remove ${ref.title}`}
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div
            className={cn(
              "relative transition-all duration-300",
              isRecording ? "h-0 overflow-hidden opacity-0" : "opacity-100"
            )}
          >
            {mentionOpen && mentionAssets.length > 0 && (
              <AssetMentionPopover
                assets={mentionAssets}
                query={mentionQuery}
                selectedIndex={mentionIndex}
                onSelect={selectMentionAsset}
              />
            )}
            <PromptInputTextarea
              inputRef={textareaRef}
              onKeyDown={handleMentionKeyDown}
              placeholder={
                showSearch
                  ? "Search the web..."
                  : showThink
                    ? "Think deeply..."
                    : showCanvas
                      ? "Create on canvas..."
                      : placeholder
              }
              className="text-base"
              disabled={isLoading || isVoiceBusy}
            />
          </div>

          {isRecording && <VoiceRecorder durationSeconds={durationSeconds} />}

          <PromptInputActions className="flex items-center justify-between gap-2 p-0 pt-2">
            <div
              className={cn(
                "flex items-center gap-1 transition-opacity duration-300",
                isRecording ? "invisible h-0 opacity-0" : "visible opacity-100"
              )}
            >
              <div className="relative">
                <input
                  ref={uploadInputRef}
                  id="chat-file-upload"
                  type="file"
                  className="hidden"
                  multiple
                  disabled={isRecording || isLoading}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      processFiles(Array.from(e.target.files));
                    }
                    if (e.target) e.target.value = "";
                  }}
                  accept={CHAT_FILE_ACCEPT}
                />
                <label
                  htmlFor="chat-file-upload"
                  title="Upload files"
                  aria-label="Upload files"
                  className={cn(
                    "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-gray-600/30 hover:text-[#D1D5DB]",
                    (isRecording || isLoading) && "pointer-events-none opacity-50"
                  )}
                >
                  <Paperclip className="h-5 w-5 transition-colors" />
                </label>
              </div>

              {showModeToggles && (
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleToggleChange("search")}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-full border px-2 py-1 transition-all",
                    showSearch
                      ? "border-[#1EAEDB] bg-[#1EAEDB]/15 text-[#1EAEDB]"
                      : "border-transparent bg-transparent text-[#9CA3AF] hover:text-[#D1D5DB]"
                  )}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <motion.div
                      animate={{ rotate: showSearch ? 360 : 0, scale: showSearch ? 1.1 : 1 }}
                      whileHover={{
                        rotate: showSearch ? 360 : 15,
                        scale: 1.1,
                        transition: { type: "spring", stiffness: 300, damping: 10 },
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                    >
                      <Globe
                        className={cn("h-4 w-4", showSearch ? "text-[#1EAEDB]" : "text-inherit")}
                      />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {showSearch && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="shrink-0 overflow-hidden text-xs whitespace-nowrap text-[#1EAEDB]"
                      >
                        Search
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <CustomDivider />

                <button
                  type="button"
                  onClick={() => handleToggleChange("think")}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-full border px-2 py-1 transition-all",
                    showThink
                      ? "border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#8B5CF6]"
                      : "border-transparent bg-transparent text-[#9CA3AF] hover:text-[#D1D5DB]"
                  )}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <motion.div
                      animate={{ rotate: showThink ? 360 : 0, scale: showThink ? 1.1 : 1 }}
                      whileHover={{
                        rotate: showThink ? 360 : 15,
                        scale: 1.1,
                        transition: { type: "spring", stiffness: 300, damping: 10 },
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                    >
                      <BrainCog
                        className={cn("h-4 w-4", showThink ? "text-[#8B5CF6]" : "text-inherit")}
                      />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {showThink && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="shrink-0 overflow-hidden text-xs whitespace-nowrap text-[#8B5CF6]"
                      >
                        Think
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <CustomDivider />

                <button
                  type="button"
                  onClick={handleCanvasToggle}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-full border px-2 py-1 transition-all",
                    showCanvas
                      ? "border-[#F97316] bg-[#F97316]/15 text-[#F97316]"
                      : "border-transparent bg-transparent text-[#9CA3AF] hover:text-[#D1D5DB]"
                  )}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <motion.div
                      animate={{ rotate: showCanvas ? 360 : 0, scale: showCanvas ? 1.1 : 1 }}
                      whileHover={{
                        rotate: showCanvas ? 360 : 15,
                        scale: 1.1,
                        transition: { type: "spring", stiffness: 300, damping: 10 },
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                    >
                      <FolderCode
                        className={cn("h-4 w-4", showCanvas ? "text-[#F97316]" : "text-inherit")}
                      />
                    </motion.div>
                  </div>
                  <AnimatePresence>
                    {showCanvas && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="shrink-0 overflow-hidden text-xs whitespace-nowrap text-[#F97316]"
                      >
                        Canvas
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
              )}
            </div>

            <PromptInputAction
              tooltip={
                isLoading
                  ? "Stop generation"
                  : isTranscribing
                    ? "Transcribing..."
                    : isRecording
                      ? "Stop recording"
                      : hasContent
                        ? "Send message"
                        : "Voice message"
              }
            >
              <Button
                variant="default"
                size="icon"
                disabled={isTranscribing}
                className={cn(
                  "h-8 w-8 rounded-full transition-all duration-200",
                  isRecording
                    ? "bg-transparent text-red-500 hover:bg-gray-600/30 hover:text-red-400"
                    : hasContent
                      ? "bg-white text-[#1F2023] hover:bg-white/80"
                      : "bg-transparent text-[#9CA3AF] hover:bg-gray-600/30 hover:text-[#D1D5DB]"
                )}
                onClick={handleVoiceButtonClick}
              >
                {isLoading ? (
                  <Square className="h-4 w-4 animate-pulse fill-[#1F2023]" />
                ) : isTranscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#9CA3AF]" />
                ) : isRecording ? (
                  <StopCircle className="h-5 w-5 text-red-500" />
                ) : hasContent ? (
                  <ArrowUp className="h-4 w-4 text-[#1F2023]" />
                ) : (
                  <Mic className="h-5 w-5 text-inherit transition-colors" />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>

        <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
      </>
    );
  }
);
PromptInputBox.displayName = "PromptInputBox";
