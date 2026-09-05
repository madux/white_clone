import DocumentListPage from "@/app/components/DocumentListPage";
import AdminOnly from "@/app/components/AdminOnly";

export default function OrganizationFilesPage() {
  return <AdminOnly><DocumentListPage kind="organization" /></AdminOnly>;
}
