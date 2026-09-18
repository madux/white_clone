import { redirect } from "next/navigation";

export default function EmployeeIssuesRoute() {
  redirect("/pages/employee?tab=issues");
}
