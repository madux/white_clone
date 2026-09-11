"use client";

import { Component, type ReactNode } from "react";

type Props = {
  fallback: ReactNode;
  onError?: () => void;
  children: ReactNode;
};

export default class EditorErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}
