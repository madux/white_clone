import { redirect } from "next/navigation";

export default function PendingUploadsRoute() {
  redirect("/pages/approvals?kind=employee");
}
