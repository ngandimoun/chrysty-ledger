"use client";

import { Check } from "lucide-react";
import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceAsset } from "@/lib/asset-types";
import { buildRecentActivity, buildSuggestions } from "@/lib/workspace-overview";
import { cn } from "@/lib/utils";

type WorkspaceOverviewProps = {
  workspaceName: string;
  assets: WorkspaceAsset[];
  onSuggestionClick: (prompt: string) => void;
  onOpenAsset?: (assetId: string) => void;
  className?: string;
};

function SuggestionsSection({
  suggestions,
  onSuggestionClick,
}: {
  suggestions: ReturnType<typeof buildSuggestions>;
  onSuggestionClick: (prompt: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <section className="mt-8">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Suggestions
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSuggestionClick(chip.prompt)}
            className={cn(
              "rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium",
              "text-foreground transition-colors hover:border-primary/40 hover:bg-primary/8"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function WorkspaceOverview({
  workspaceName,
  assets,
  onSuggestionClick,
  onOpenAsset,
  className,
}: WorkspaceOverviewProps) {
  const recentActivity = useMemo(() => buildRecentActivity(assets), [assets]);
  const suggestions = useMemo(() => buildSuggestions(assets), [assets]);
  const isEmpty = assets.length === 0;

  return (
    <div
      className={cn(
        "flex h-full min-h-[16rem] flex-col items-center justify-center px-6 py-8 sm:px-10",
        className
      )}
    >
      <div className="mx-auto w-full max-w-2xl text-left">
        {isEmpty ? (
          <>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Welcome to Chrysty Ledger
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              What would you like to do?
            </p>
            <SuggestionsSection
              suggestions={suggestions}
              onSuggestionClick={onSuggestionClick}
            />
          </>
        ) : (
          <>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Workspace Overview
            </p>

            <Card className="mt-4 ring-foreground/10">
              <CardHeader className="border-b">
                <CardTitle>{workspaceName}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Assets: {assets.length}
                </p>
              </CardHeader>

              {recentActivity.length > 0 && (
                <CardContent className="pt-4">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Recent Activity
                  </p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {recentActivity.map((item) => (
                      <li key={item.assetId}>
                        <button
                          type="button"
                          onClick={() => onOpenAsset?.(item.assetId)}
                          disabled={!onOpenAsset}
                          className={cn(
                            "flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                            onOpenAsset && "hover:bg-muted/60"
                          )}
                        >
                          <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground">
                              {item.line}
                            </span>
                            {item.summary && (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {item.summary}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>

            <SuggestionsSection
              suggestions={suggestions}
              onSuggestionClick={onSuggestionClick}
            />
          </>
        )}
      </div>
    </div>
  );
}
