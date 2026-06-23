"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMemo } from "react";

import type { DocumentArtifact } from "@/lib/artifact-types";
import { cn } from "@/lib/utils";

type AssetDocumentProps = {
  artifact: DocumentArtifact;
  className?: string;
};

function contentToDoc(content: string) {
  const paragraphs = content.split("\n").filter((line, index, lines) => {
    return line.length > 0 || index < lines.length - 1;
  });

  if (paragraphs.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  return {
    type: "doc",
    content: paragraphs.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

export function AssetDocument({ artifact, className }: AssetDocumentProps) {
  const initialContent = useMemo(() => contentToDoc(artifact.content), [artifact.content]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editable: false,
    immediatelyRender: false,
  });

  return (
    <article className={cn("mx-auto max-w-2xl", className)}>
      <h3 className="text-lg font-semibold text-foreground">{artifact.title}</h3>
      <div className="prose prose-sm dark:prose-invert mt-4 max-w-none text-foreground/90">
        <EditorContent editor={editor} />
      </div>
    </article>
  );
}
