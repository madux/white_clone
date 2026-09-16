import EmployeeFilesWorkspace from "@/app/components/EmployeeFilesWorkspace";
import AdminOnly from "@/app/components/AdminOnly";
import { Suspense } from "react";

export default function EmployeeFilesPage() {
  return (
    <AdminOnly>
      <Suspense fallback={null}>
        <EmployeeFilesWorkspace />
      </Suspense>
    </AdminOnly>
  );
}
