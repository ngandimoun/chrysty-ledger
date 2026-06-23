"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme((theme) => (theme === "dark" ? "light" : "dark"))}
      aria-label="Toggle theme"
      className={cn(
        "relative shrink-0 text-muted-foreground hover:bg-muted hover:text-primary md:size-8",
        className
      )}
    >
      <Sun className="size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90 md:size-4" />
      <Moon className="absolute size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0 md:size-4" />
    </Button>
  );
}
