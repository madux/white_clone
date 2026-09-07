import DocumentListPage from "@/app/components/DocumentListPage";
import AdminOnly from "@/app/components/AdminOnly";
import { Suspense } from "react";

export default function OrganizationFilesPage() {
  return <AdminOnly><Suspense fallback={null}><DocumentListPage kind="organization" /></Suspense></AdminOnly>;
}
