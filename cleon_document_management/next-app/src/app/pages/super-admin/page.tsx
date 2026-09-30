import SuperAdminPage from "@/app/components/SuperAdminPage";
import { Suspense } from "react";

export default function SuperAdminRoute() {
  return (
    <Suspense fallback={null}>
      <SuperAdminPage />
    </Suspense>
  );
}
