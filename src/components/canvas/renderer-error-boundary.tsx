"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type RendererErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
};

type RendererErrorBoundaryState = {
  hasError: boolean;
};

export class RendererErrorBoundary extends Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  state: RendererErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RendererErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Asset renderer error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {this.props.title ?? "This asset couldn't be displayed"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The data may be invalid or incomplete.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
