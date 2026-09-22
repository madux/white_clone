import AdminOnly from "@/app/components/AdminOnly";
import ComplianceRunDetailPage from "@/app/components/ComplianceRunDetailPage";
import { Suspense } from "react";

export default function ComplianceRunRoute() {
  return (
    <AdminOnly>
      <Suspense fallback={null}>
        <ComplianceRunDetailPage />
      </Suspense>
    </AdminOnly>
  );
}
