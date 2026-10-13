import ComplianceGate from "@/app/components/ComplianceGate";
import CompliancePage from "@/app/components/CompliancePage";
import { Suspense } from "react";

export default function ComplianceRoute() {
  return (
    <ComplianceGate>
      <Suspense fallback={null}>
        <CompliancePage />
      </Suspense>
    </ComplianceGate>
  );
}
