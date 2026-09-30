import EmployeeFilesGate from "@/app/components/EmployeeFilesGate";
import EmployeeGroupPage from "@/app/components/EmployeeGroupPage";
import { Suspense } from "react";

export default function EmployeeGroupRoute() {
  return (
    <EmployeeFilesGate>
      <Suspense fallback={null}>
        <EmployeeGroupPage />
      </Suspense>
    </EmployeeFilesGate>
  );
}
