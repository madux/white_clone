"use client";

import IntelligenceNav from "@/app/components/intelligence/IntelligenceNav";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function DocumentIntelligenceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname() || "";
  const isAsk = pathname.includes("/pages/document-intelligence/ask");
  if (isAsk) {
    return <div className="h-full min-h-0 overflow-hidden">{children}</div>;
  }
  return (
    <div className="di-shell mx-auto flex h-full min-h-0 w-full max-w-[1650px] flex-col gap-3 overflow-hidden px-6 pt-4 pb-3">
      <div className="shrink-0">
        <IntelligenceNav />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
