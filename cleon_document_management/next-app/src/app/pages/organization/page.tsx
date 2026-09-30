import DocumentListPage from "@/app/components/DocumentListPage";
import OrganizationalLibraryGate from "@/app/components/OrganizationalLibraryGate";
import { Suspense } from "react";

export default function OrganizationFilesPage() {
  return (
    <OrganizationalLibraryGate>
      <Suspense fallback={null}>
        <DocumentListPage kind="organization" />
      </Suspense>
    </OrganizationalLibraryGate>
  );
}
