import OrganizationFolderPage from "@/app/components/OrganizationFolderPage";
import AdminOnly from "@/app/components/AdminOnly";
import { Suspense } from "react";

export default function OrganizationFolderRoute() {
  return <AdminOnly><Suspense fallback={null}><OrganizationFolderPage /></Suspense></AdminOnly>;
}
