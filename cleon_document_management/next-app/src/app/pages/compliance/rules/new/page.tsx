import ComplianceGate from "@/app/components/ComplianceGate";
import ComplianceRuleCreatePage from "@/app/components/compliance/ComplianceRuleCreatePage";
import { Suspense } from "react";

export default function ComplianceRuleCreateRoute() {
  return (
    <ComplianceGate>
      <Suspense fallback={<div className="app-page text-sm text-slate-500">Loading…</div>}>
        <ComplianceRuleCreatePage />
      </Suspense>
    </ComplianceGate>
  );
}
