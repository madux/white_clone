"use client";

import IntelligenceNav from "@/app/components/intelligence/IntelligenceNav";
import type { ReactNode } from "react";

export default function DocumentIntelligenceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-full mx-auto w-full max-w-[1650px] space-y-6 rounded-2xl bg-gray-100 p-6">
      <IntelligenceNav />
      {children}
    </div>
  );
}
