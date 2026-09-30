import OrganizationFolderPage from "@/app/components/OrganizationFolderPage";
import OrganizationalLibraryGate from "@/app/components/OrganizationalLibraryGate";
import { Suspense } from "react";

export default function OrganizationFolderRoute() {
  return (
    <OrganizationalLibraryGate>
      <Suspense fallback={null}>
        <OrganizationFolderPage />
      </Suspense>
    </OrganizationalLibraryGate>
  );
}
