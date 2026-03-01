"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--text-3)",
            }}
          >
            <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚠️</p>
            <p
              style={{
                color: "var(--text-2)",
                marginBottom: "0.25rem",
                fontWeight: 600,
              }}
            >
              Something went wrong
            </p>
            <p style={{ fontSize: "0.82rem" }}>Try refreshing the page.</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
