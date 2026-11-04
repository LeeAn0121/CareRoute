'use client';
import { Component, type ReactNode } from 'react';

export default class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div role="alert" className="h-full flex items-center justify-center p-8 text-center text-foreground/70">지도를 불러오지 못했습니다. 수급자와 일정 메뉴는 계속 사용할 수 있습니다.</div>;
    return this.props.children;
  }
}
