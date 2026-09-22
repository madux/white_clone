import { redirect } from "next/navigation";

export default function PendingUploadsRoute() {
  redirect("/pages/employee?tab=pending-approvals");
}
