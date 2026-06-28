"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type RendererErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
  resetKey?: string;
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

  componentDidUpdate(prevProps: RendererErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Asset renderer error:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {this.props.title ?? "This asset couldn't be displayed"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The chart could not render yet. Try again after the panel finishes loading.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={this.handleRetry}>
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
