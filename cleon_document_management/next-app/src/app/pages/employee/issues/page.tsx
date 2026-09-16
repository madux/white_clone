import AdminOnly from "@/app/components/AdminOnly";
import EmployeeFilesIssuesPage from "@/app/components/EmployeeFilesIssuesPage";
import { Suspense } from "react";

export default function EmployeeIssuesRoute() {
  return (
    <AdminOnly>
      <Suspense fallback={null}>
        <EmployeeFilesIssuesPage />
      </Suspense>
    </AdminOnly>
  );
}
