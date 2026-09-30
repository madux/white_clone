"use client";

import { Suspense } from "react";
import HomePage from "@/app/components/HomePage";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <HomePage />
    </Suspense>
  );
}
