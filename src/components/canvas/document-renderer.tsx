"use client";

import type { Asset } from "@/lib/assets/asset";
import { AssetInvoice } from "@/components/workspace/asset-invoice";
import { assetV2ToArtifact } from "@/lib/assets/adapters/legacy";
import { cn } from "@/lib/utils";

type DocumentRendererProps = {
  asset: Asset;
  className?: string;
};

export function DocumentRenderer({ asset, className }: DocumentRendererProps) {
  if (asset.subtype === "invoice") {
    const artifact = assetV2ToArtifact(asset);
    if (artifact.kind === "invoice") {
      return <AssetInvoice artifact={artifact} className={className} />;
    }
  }

  const sections = (asset.data.sections as { title: string; body: string }[]) ?? [];

  if (!sections.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No document sections available.
      </div>
    );
  }

  return (
    <article className={cn("mx-auto max-w-2xl space-y-6", className)}>
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
          <div className="prose prose-sm dark:prose-invert mt-2 max-w-none whitespace-pre-wrap text-foreground/90">
            {section.body || "—"}
          </div>
        </section>
      ))}
    </article>
  );
}
