import OrganizationalPolicyAssignmentsPage from "@/app/components/OrganizationalPolicyAssignmentsPage";
import OrganizationalLibraryGate from "@/app/components/OrganizationalLibraryGate";

export default function OrganizationPolicyAssignmentsPage() {
  return (
    <OrganizationalLibraryGate>
      <OrganizationalPolicyAssignmentsPage />
    </OrganizationalLibraryGate>
  );
}
