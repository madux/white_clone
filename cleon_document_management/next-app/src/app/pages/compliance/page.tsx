"use client";

import { Suspense } from "react";
import ComplianceRedirectPage from "./ComplianceRedirectPage";

/** Legacy route — compliance lives under Employee Files. */
export default function ComplianceRoute() {
  return (
    <Suspense fallback={null}>
      <ComplianceRedirectPage />
    </Suspense>
  );
}
