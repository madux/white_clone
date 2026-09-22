import { redirect } from "next/navigation";

export default function RolesRoute() {
  redirect("/pages/settings?section=roles");
}
