import EmployeeProfilePage from "@/app/components/EmployeeProfilePage";
import { Suspense } from "react";

export default function EmployeeProfileRoute() {
  return <Suspense fallback={null}><EmployeeProfilePage /></Suspense>;
}
