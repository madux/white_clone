import EmployeeFolderPage from "@/app/components/EmployeeFolderPage";
import AdminOnly from "@/app/components/AdminOnly";
import { Suspense } from "react";

export default function EmployeeFolderRoute() {
  return <AdminOnly><Suspense fallback={null}><EmployeeFolderPage /></Suspense></AdminOnly>;
}
