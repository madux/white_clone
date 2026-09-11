"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import Header from "@/app/components/Header";
import Sidebar from "@/app/components/Sidebar";

function isImmersive(pathname: string) {
  return (
    pathname.includes("/pages/document-intelligence/ask") ||
    pathname.includes("/templates-forms/generate") ||
    pathname.includes("/templates-forms/editor")
  );
}

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  if (isImmersive(pathname)) {
    return <div className="h-screen overflow-hidden bg-[#f4f5f8]">{children}</div>;
  }
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        <Suspense fallback={null}>
          <Header />
        </Suspense>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
