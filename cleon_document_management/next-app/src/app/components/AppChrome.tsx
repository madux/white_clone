"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import Header from "@/app/components/Header";
import OfflineBanner from "@/app/components/OfflineBanner";
import WorkspaceRouteGuard from "@/app/components/WorkspaceRouteGuard";

function isImmersive(pathname: string) {
  return (
    pathname.includes("/pages/document-intelligence/ask") ||
    pathname.includes("/templates-forms/generate") ||
    pathname.includes("/templates-forms/editor") ||
    pathname.includes("/organization/policy-editor")
  );
}

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  if (isImmersive(pathname)) {
    return <div className="h-screen overflow-hidden bg-[#f4f5f8]">{children}</div>;
  }
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <OfflineBanner />
      <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
        <WorkspaceRouteGuard>{children}</WorkspaceRouteGuard>
      </main>
    </div>
  );
}
