"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ChatErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} className="text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              {this.state.error.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
