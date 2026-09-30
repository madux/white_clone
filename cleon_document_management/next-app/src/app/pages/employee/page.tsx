import EmployeeFilesWorkspace from "@/app/components/EmployeeFilesWorkspace";
import EmployeeFilesGate from "@/app/components/EmployeeFilesGate";
import { Suspense } from "react";

export default function EmployeeFilesPage() {
  return (
    <EmployeeFilesGate>
      <Suspense fallback={null}>
        <EmployeeFilesWorkspace />
      </Suspense>
    </EmployeeFilesGate>
  );
}
