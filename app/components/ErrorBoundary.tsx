'use client';

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: (error: Error) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!);
      }
      return (
        <div className="p-4 bg-red-900/20 text-red-400 rounded-xl overflow-auto border border-red-500/30">
          <h2 className="text-xl font-bold mb-2">BlockEditor crashed!</h2>
          <pre className="text-xs whitespace-pre-wrap">{this.state.error?.message}</pre>
          <pre className="text-[10px] mt-4 opacity-50 whitespace-pre-wrap">{this.state.error?.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
