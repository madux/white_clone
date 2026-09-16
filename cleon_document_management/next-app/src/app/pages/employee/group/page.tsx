import AdminOnly from "@/app/components/AdminOnly";
import EmployeeGroupPage from "@/app/components/EmployeeGroupPage";
import { Suspense } from "react";

export default function EmployeeGroupRoute() {
  return (
    <AdminOnly>
      <Suspense fallback={null}>
        <EmployeeGroupPage />
      </Suspense>
    </AdminOnly>
  );
}
