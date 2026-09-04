import EmployeeFolderPage from "@/app/components/EmployeeFolderPage";
import { Suspense } from "react";

export default function EmployeeFolderRoute() {
  return <Suspense fallback={null}><EmployeeFolderPage /></Suspense>;
}
