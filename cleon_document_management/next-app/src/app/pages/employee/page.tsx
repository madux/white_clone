import DocumentListPage from "@/app/components/DocumentListPage";
import AdminOnly from "@/app/components/AdminOnly";
import { Suspense } from "react";

export default function EmployeeFilesPage() {
  return <AdminOnly><Suspense fallback={null}><DocumentListPage kind="employee" /></Suspense></AdminOnly>;
}
