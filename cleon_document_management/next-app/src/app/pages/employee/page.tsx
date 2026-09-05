import DocumentListPage from "@/app/components/DocumentListPage";
import AdminOnly from "@/app/components/AdminOnly";

export default function EmployeeFilesPage() {
  return <AdminOnly><DocumentListPage kind="employee" /></AdminOnly>;
}
