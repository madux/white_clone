import CompliancePage from "@/app/components/CompliancePage";
import AdminOnly from "@/app/components/AdminOnly";

export default function ComplianceRoute() {
  return (
    <AdminOnly>
      <CompliancePage />
    </AdminOnly>
  );
}
