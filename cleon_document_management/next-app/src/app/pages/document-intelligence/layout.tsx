"use client";

import IntelligenceNav from "@/app/components/intelligence/IntelligenceNav";
import type { ReactNode } from "react";

export default function DocumentIntelligenceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="di-shell mx-auto flex h-full min-h-0 w-full max-w-[1650px] flex-col gap-3 overflow-hidden px-6 pt-4 pb-3">
      <div className="shrink-0">
        <IntelligenceNav />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
