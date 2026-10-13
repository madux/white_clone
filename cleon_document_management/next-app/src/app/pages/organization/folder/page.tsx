import OrganizationalFilesPage from "@/app/components/OrganizationalFilesPage";
import OrganizationalLibraryGate from "@/app/components/OrganizationalLibraryGate";
import { Suspense } from "react";

export default function OrganizationFolderRoute() {
  return (
    <OrganizationalLibraryGate>
      <Suspense fallback={null}>
        <OrganizationalFilesPage />
      </Suspense>
    </OrganizationalLibraryGate>
  );
}
