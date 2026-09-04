import OrganizationFolderPage from "@/app/components/OrganizationFolderPage";
import { Suspense } from "react";

export default function OrganizationFolderRoute() {
  return <Suspense fallback={null}><OrganizationFolderPage /></Suspense>;
}
