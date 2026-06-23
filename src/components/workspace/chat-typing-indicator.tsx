"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

const DOT_COLORS = ["bg-primary", "bg-[#1EAEDB]", "bg-secondary"] as const;
const STAGGER_DELAYS = [0, 0.15, 0.3] as const;

const dotAnimation = {
  y: [0, -5, 0],
  opacity: [0.35, 1, 0.35],
  scale: [1, 1.15, 1],
};

type ChatTypingIndicatorProps = {
  className?: string;
};

export function ChatTypingIndicator({ className }: ChatTypingIndicatorProps) {
  return (
    <span
      role="status"
      aria-label="Assistant is responding"
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      {DOT_COLORS.map((color, index) => (
        <motion.span
          key={color}
          className={cn("h-2 w-2 rounded-full", color)}
          animate={dotAnimation}
          transition={{
            duration: 0.55,
            repeat: Infinity,
            ease: "easeInOut",
            delay: STAGGER_DELAYS[index],
          }}
        />
      ))}
    </span>
  );
}
