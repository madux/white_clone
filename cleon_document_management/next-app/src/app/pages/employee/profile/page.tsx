import EmployeeProfilePage from "@/app/components/EmployeeProfilePage";
import AdminOnly from "@/app/components/AdminOnly";
import { Suspense } from "react";

export default function EmployeeProfileRoute() {
  return <AdminOnly><Suspense fallback={null}><EmployeeProfilePage /></Suspense></AdminOnly>;
}
