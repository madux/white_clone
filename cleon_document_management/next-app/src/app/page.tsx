import Dashboard from "@/app/components/Dashboard";
import AdminOnly from "@/app/components/AdminOnly";

export default function Home() {
  return <AdminOnly><Dashboard /></AdminOnly>;
}
