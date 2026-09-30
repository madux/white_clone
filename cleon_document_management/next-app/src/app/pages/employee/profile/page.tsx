import EmployeeProfilePage from "@/app/components/EmployeeProfilePage";
import EmployeeFilesGate from "@/app/components/EmployeeFilesGate";
import { Suspense } from "react";

export default function EmployeeProfileRoute() {
  return (
    <EmployeeFilesGate>
      <Suspense fallback={null}>
        <EmployeeProfilePage />
      </Suspense>
    </EmployeeFilesGate>
  );
}
