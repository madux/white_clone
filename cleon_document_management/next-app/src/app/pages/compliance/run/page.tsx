import ComplianceGate from "@/app/components/ComplianceGate";
import ComplianceRunDetailPage from "@/app/components/ComplianceRunDetailPage";
import { Suspense } from "react";

export default function ComplianceRunRoute() {
  return (
    <ComplianceGate>
      <Suspense fallback={null}>
        <ComplianceRunDetailPage />
      </Suspense>
    </ComplianceGate>
  );
}
