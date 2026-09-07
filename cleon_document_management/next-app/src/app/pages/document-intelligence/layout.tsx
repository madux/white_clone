"use client";

import IntelligenceNav from "@/app/components/intelligence/IntelligenceNav";
import type { ReactNode } from "react";

export default function DocumentIntelligenceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1650px] flex-col space-y-6 p-6">
      <IntelligenceNav />
      {children}
    </div>
  );
}
