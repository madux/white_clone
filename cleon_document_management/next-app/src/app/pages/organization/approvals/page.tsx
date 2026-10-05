import { redirect } from "next/navigation";

export default function OrganizationalApprovalsRedirect() {
  redirect("/pages/approvals?kind=organizational");
}
