import EmployeeFolderPage from "@/app/components/EmployeeFolderPage";
import EmployeeFilesGate from "@/app/components/EmployeeFilesGate";
import { Suspense } from "react";

export default function EmployeeFolderRoute() {
  return (
    <EmployeeFilesGate>
      <Suspense fallback={null}>
        <EmployeeFolderPage />
      </Suspense>
    </EmployeeFilesGate>
  );
}
